import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Tenant } from '@repo/lintelia/schemas';
import { platformSettings, platformUsers, roles, ssoIdentities, ssoOrganizationIndex, tenantSsoSettings, userRoles, users } from '../../entities';
import type { Databases } from '../../clients/database.client';
import { DATABASES } from '../../injector/tokens/databases.token';
import { redis } from '../../clients/redis.client';
import { env, tenantWebUrl } from '../../constants';
import { AuditWriter, type AuditActor } from '../../services/audit.writer';
import { TenantDirectory } from '../../services/tenant-directory.service';
import { OneTimeSecrets } from '../session.store';
import { AuthError, IdentityService, type Session } from '../identity.service';
import { SSO_BROKER, type SsoBroker } from './broker';
import { RoleSync } from '../../access/role-sync';
import { MemberAttributeSync } from '../../access/attributes';
import { AccessNotifier } from '../../access/notify';

const STATE_TTL_SECONDS = 10 * 60;
const HANDOFF_TTL_SECONDS = 60;
const domainOf = (email: string) => email.trim().toLowerCase().split('@')[1] ?? '';

/**
 * Single sign-on for institution members through the SSO broker (docs/plans/02): setup links to the broker's Admin
 * Portal, enforcement per verified domain, home-realm discovery, the sign-in round trip and just-in-time provisioning.
 * Sessions stay ours; MFA is the IdP's business for SSO sign-ins.
 */
@Injectable()
export class SsoService {
  private readonly secrets = new OneTimeSecrets(redis());

  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(SSO_BROKER) private readonly broker: SsoBroker,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(TenantDirectory) private readonly directory: TenantDirectory,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(RoleSync) private readonly roleSync: RoleSync,
    @Inject(MemberAttributeSync) private readonly attributes: MemberAttributeSync,
    @Inject(AccessNotifier) private readonly notifier: AccessNotifier,
  ) { }

  private db(tenantId: string) {
    return this.databases.forTenant(tenantId);
  }

  async settings(tenantId: string) {
    const [row] = await this.db(tenantId).select().from(tenantSsoSettings).limit(1);
    return row ?? null;
  }

  private async save(tenantId: string, changes: Partial<typeof tenantSsoSettings.$inferInsert>) {
    const [row] = await this.db(tenantId).insert(tenantSsoSettings).values(changes)
      .onConflictDoUpdate({ target: tenantSsoSettings.tenantId, set: changes }).returning();
    return row;
  }

  /** The organization's state at the broker; refreshes the cached verified domains. */
  async status(tenant: Tenant) {
    const settings = await this.settings(tenant.id);
    if (!settings?.organizationId) return { configured: false, organizationId: null, connections: [], domains: [], enforce: false, jit: { enabled: false, defaultRoles: [] as string[] }, ready: false, rolesFromIdp: false };
    const organization = await this.broker.organization(settings.organizationId);
    const verified = organization.domains.filter((d) => d.state === 'verified').map((d) => d.domain.toLowerCase());
    if (verified.join(',') !== settings.verifiedDomains.join(',')) {
      await this.save(tenant.id, { verifiedDomains: verified });
      // Single sign-on just got linked (a first verified domain): from now on, roles of its people come from the IdP.
      const added = verified.filter((d) => !settings.verifiedDomains.includes(d));
      if (added.length) {
        await this.audit.record(tenant.id, { type: 'system', email: 'sso' }, 'sso.domains_verified', { type: 'tenant', id: tenant.id }, { domains: added });
        await this.notifier.send(tenant, {
          subject: `Roles of ${added.join(', ')} now come from your identity provider`,
          lines: [
            `Single sign-on is linked for ${added.join(', ')}. From their next sign-in through your identity provider (or its directory), people of these domains hold the roles their groups map to, and their roles can no longer be changed by hand.`,
            'Map your groups to roles in Settings → Security before they sign in; administrators keep their role until a group is mapped to the Administrator role.',
          ],
          link: '/app/settings?tab=security',
        }).catch(() => undefined);
      }
    }
    const ready = verified.length > 0 && organization.connections.some((c) => c.state === 'active');
    return {
      configured: true, organizationId: settings.organizationId, connections: organization.connections, domains: organization.domains,
      enforce: settings.enforce, jit: { enabled: settings.jitEnabled, defaultRoles: settings.jitDefaultRoles }, ready,
      /** Roles of people of the verified domains come from the IdP's groups (docs/plans/15 §5.4, §13): linked SSO. */
      rolesFromIdp: verified.length > 0,
    };
  }

  /** A link to the broker's Admin Portal for the institution's IT (creates the organization the first time). */
  async setupLink(tenant: Tenant, intent: 'sso' | 'domain_verification' | 'dsync', actor: AuditActor) {
    let settings = await this.settings(tenant.id);
    if (!settings?.organizationId) {
      const organizationId = await this.broker.createOrganization({ name: tenant.name, externalId: tenant.id });
      settings = await this.save(tenant.id, { organizationId, updatedByEmail: actor.email ?? null });
      await this.databases.platform.insert(ssoOrganizationIndex).values({ organizationId, tenantId: tenant.id }).onConflictDoNothing();
      await this.audit.record(tenant.id, actor, 'sso.organization_created', { type: 'tenant', id: tenant.id }, { organizationId });
    }
    const link = await this.broker.setupLink(settings.organizationId!, intent as 'sso', tenantWebUrl(tenant.domain, '/app/settings?tab=security'));
    await this.audit.record(tenant.id, actor, 'sso.setup_link_created', { type: 'tenant', id: tenant.id }, { intent });
    return { link, organizationId: settings.organizationId };
  }

  async updateSettings(tenant: Tenant, input: { enforce?: boolean; jit?: { enabled?: boolean; defaultRoles?: string[] } }, actor: AuditActor) {
    const status = await this.status(tenant);
    if (!status.configured) throw new AuthError('Set up single sign-on first', 409);
    const changes: Partial<typeof tenantSsoSettings.$inferInsert> = { updatedByEmail: actor.email ?? null };
    if (input.enforce !== undefined) {
      // Enforcing needs an active connection and at least one domain verified at the broker (nobody enforces SSO on
      // someone else's domain).
      if (input.enforce && !status.ready) throw new AuthError('Single sign-on can be enforced once a connection is active and a domain is verified', 409);
      changes.enforce = input.enforce;
    }
    if (input.jit) {
      const keys = input.jit.defaultRoles ?? status.jit.defaultRoles;
      if (keys.length) {
        const found = await this.db(tenant.id).select({ key: roles.key }).from(roles).where(inArray(roles.key, keys));
        const missing = keys.filter((k) => !found.some((f) => f.key === k));
        if (missing.length) throw new AuthError(`Unknown roles: ${missing.join(', ')}`, 400);
      }
      changes.jitEnabled = input.jit.enabled ?? status.jit.enabled;
      changes.jitDefaultRoles = keys;
    }
    await this.save(tenant.id, changes);
    await this.audit.record(tenant.id, actor, 'sso.settings_changed', { type: 'tenant', id: tenant.id }, { enforce: changes.enforce, jit: changes.jitEnabled, defaultRoles: changes.jitDefaultRoles });
    return this.status(tenant);
  }

  /** Home-realm discovery: does this address sign in through the institution's IdP? */
  async discover(tenant: Tenant, email: string) {
    const settings = await this.settings(tenant.id);
    const domain = domainOf(email);
    if (!settings?.organizationId || !domain) return { sso: false, enforce: false };
    const status = await this.status(tenant);
    const covered = status.ready && status.domains.some((d) => d.state === 'verified' && d.domain.toLowerCase() === domain);
    if (!covered) return { sso: false, enforce: false };
    const redirectUrl = `${env.HOST.replace(/\/$/, '')}/auth/sso/start?${new URLSearchParams({ tenant: tenant.domain, email })}`;
    return { sso: true, enforce: status.enforce, redirectUrl };
  }

  // --- platform staff through the company IdP ------------------------------------------------------------------------

  private async staffSettings() {
    const [row] = await this.databases.platform.select().from(platformSettings).where(eq(platformSettings.key, 'staff_sso')).limit(1);
    return (row?.value ?? {}) as { organizationId?: string; enforce?: boolean; verifiedDomains?: string[] };
  }

  private async saveStaffSettings(changes: Record<string, unknown>, by: string | null) {
    const value = { ...(await this.staffSettings()), ...changes };
    await this.databases.platform.insert(platformSettings).values({ key: 'staff_sso', value, updatedByEmail: by })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedByEmail: by } });
    return value;
  }

  async staffStatus() {
    const settings = await this.staffSettings();
    if (!settings.organizationId) return { configured: false, organizationId: null, connections: [], domains: [], enforce: false, ready: false };
    const organization = await this.broker.organization(settings.organizationId);
    const verified = organization.domains.filter((d) => d.state === 'verified').map((d) => d.domain.toLowerCase());
    if (verified.join(',') !== (settings.verifiedDomains ?? []).join(',')) await this.saveStaffSettings({ verifiedDomains: verified }, null);
    const ready = verified.length > 0 && organization.connections.some((c) => c.state === 'active');
    return { configured: true, organizationId: settings.organizationId, connections: organization.connections, domains: organization.domains, enforce: !!settings.enforce, ready };
  }

  async staffSetupLink(intent: 'sso' | 'domain_verification', by: string) {
    let settings = await this.staffSettings();
    if (!settings.organizationId) {
      const organizationId = await this.broker.createOrganization({ name: 'Lintelia staff', externalId: 'lintelia-staff' });
      settings = await this.saveStaffSettings({ organizationId }, by);
    }
    return { link: await this.broker.setupLink(settings.organizationId!, intent, new URL('/app/platform/staff', env.WEB_URL).toString()), organizationId: settings.organizationId };
  }

  async updateStaffSettings(input: { enforce?: boolean }, by: string) {
    const status = await this.staffStatus();
    if (!status.configured) throw new AuthError('Set up single sign-on first', 409);
    if (input.enforce && !status.ready) throw new AuthError('Single sign-on can be enforced once a connection is active and a domain is verified', 409);
    await this.saveStaffSettings({ enforce: !!input.enforce }, by);
    return this.staffStatus();
  }

  async discoverStaff(email: string) {
    const settings = await this.staffSettings();
    const domain = domainOf(email);
    if (!settings.organizationId || !domain) return { sso: false, enforce: false };
    const status = await this.staffStatus();
    const covered = status.ready && status.domains.some((d) => d.state === 'verified' && d.domain.toLowerCase() === domain);
    if (!covered) return { sso: false, enforce: false };
    return { sso: true, enforce: status.enforce, redirectUrl: `${env.HOST.replace(/\/$/, '')}/auth/sso/start?${new URLSearchParams({ email })}` };
  }

  /** Staff passwords are refused for the company domain once SSO is enforced (break-glass accounts excepted). */
  async staffSsoEnforced(email: string) {
    const settings = await this.staffSettings();
    return !!settings.enforce && (settings.verifiedDomains ?? []).includes(domainOf(email)) && !env.STAFF_BREAK_GLASS_EMAILS.includes(email.trim().toLowerCase());
  }

  private async startStaff(email: string) {
    const discovered = await this.discoverStaff(email);
    if (!discovered.sso) throw new AuthError('Single sign-on is not available for this address', 400);
    const settings = await this.staffSettings();
    const state = randomBytes(24).toString('base64url');
    await this.secrets.put('sso-state', state, { realm: 'staff', email: email.trim().toLowerCase() }, STATE_TTL_SECONDS);
    return this.broker.authorizationUrl({ organizationId: settings.organizationId!, redirectUri: `${env.HOST.replace(/\/$/, '')}/auth/sso/callback`, state, loginHint: email });
  }

  private async staffCallback(code: string) {
    const settings = await this.staffSettings();
    const profile = await this.broker.profile(code);
    const email = profile.email.trim().toLowerCase();
    if (!settings.organizationId || profile.organizationId !== settings.organizationId) throw new AuthError('This identity provider is not the company IdP', 403);
    if (!(settings.verifiedDomains ?? []).includes(domainOf(email))) throw new AuthError('This e-mail domain is not verified for the platform', 403);
    // No just-in-time accounts for staff: platform roles are granted by invitation only.
    const [staff] = await this.databases.platform.select().from(platformUsers).where(sql`lower(${platformUsers.email}) = ${email}`).limit(1);
    if (!staff || staff.status === 'disabled') throw new AuthError('You do not have a staff account: ask a platform administrator to invite you', 403);
    if (staff.status === 'invited') await this.databases.platform.update(platformUsers).set({ status: 'active' }).where(eq(platformUsers.id, staff.id));
    const session = await this.identity.sessionForStaff(staff.id);
    const handoff = randomBytes(24).toString('base64url');
    await this.secrets.put('sso-handoff', handoff, { session, tenantId: null } as unknown as Record<string, unknown>, HANDOFF_TTL_SECONDS);
    return new URL(`/sign-on?sso=${handoff}`, env.WEB_URL).toString();
  }

  /** Begin the round trip: remember who asked (state) and send the browser to the broker. */
  async start(tenantKey: string, email: string) {
    if (!tenantKey) return this.startStaff(email);
    const tenant = await this.directory.findByKey(tenantKey);
    if (!tenant || tenant.status !== 'active') throw new AuthError('Unknown institution', 404);
    const discovered = await this.discover(tenant, email);
    if (!discovered.sso) throw new AuthError('Single sign-on is not available for this address', 400);
    const settings = (await this.settings(tenant.id))!;
    const state = randomBytes(24).toString('base64url');
    await this.secrets.put('sso-state', state, { tenantId: tenant.id, email: email.trim().toLowerCase() }, STATE_TTL_SECONDS);
    return this.broker.authorizationUrl({ organizationId: settings.organizationId!, redirectUri: `${env.HOST.replace(/\/$/, '')}/auth/sso/callback`, state, loginHint: email });
  }

  /**
   * Back from the broker: the profile must belong to the institution's organization and a verified domain; the
   * member is linked (or provisioned just in time) and gets our session, handed to the web app with a one-time code.
   */
  async callback(code: string, state: string): Promise<string> {
    const pending = await this.secrets.take<{ tenantId?: string; email: string; realm?: 'staff' }>('sso-state', state ?? '');
    if (!pending) throw new AuthError('The sign-in expired: start again', 400);
    if (pending.realm === 'staff') return this.staffCallback(code);
    const tenant = await this.directory.findById(pending.tenantId!);
    if (!tenant || tenant.status !== 'active') throw new AuthError('Unknown institution', 404);
    const settings = (await this.settings(tenant.id))!;
    const profile = await this.broker.profile(code);
    const email = profile.email.trim().toLowerCase();
    if (profile.organizationId !== settings.organizationId) throw new AuthError('This identity provider does not belong to this institution', 403);
    if (!settings.verifiedDomains.includes(domainOf(email))) throw new AuthError('This e-mail domain is not verified for this institution', 403);

    const db = this.db(tenant.id);
    const actor = { type: 'member', email };
    let [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (user && user.kind !== 'member') throw new AuthError('This address belongs to a client account', 403);
    if (user && user.status === 'disabled') throw new AuthError('This account is disabled', 403);
    if (!user) {
      if (!settings.jitEnabled) throw new AuthError('You do not have an account in this workspace yet: ask an administrator to invite you', 403);
      const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || email;
      [user] = await db.insert(users).values({ email, name, kind: 'member', status: 'active' }).returning();
      // People of a verified SSO domain get their roles from their groups below (the default roles when none maps).
      if (settings.jitDefaultRoles.length && !RoleSync.inSsoDomain(settings, email)) {
        const roleRows = await db.select({ id: roles.id }).from(roles).where(inArray(roles.key, settings.jitDefaultRoles));
        if (roleRows.length) await db.insert(userRoles).values(roleRows.map((r) => ({ userId: user!.id, roleId: r.id, source: 'default' as const, grantedByEmail: 'just-in-time' }))).onConflictDoNothing();
      }
      await this.audit.record(tenant.id, { ...actor, id: user.id }, 'member.jit_provisioned', { type: 'user', id: user.id }, { roles: RoleSync.inSsoDomain(settings, email) ? 'from groups' : settings.jitDefaultRoles, connection: profile.connectionId });
    } else if (user.status === 'invited') {
      [user] = await db.update(users).set({ status: 'active' }).where(eq(users.id, user.id)).returning();
    }
    await db.insert(ssoIdentities).values({ userId: user.id, profileId: profile.id, connectionId: profile.connectionId, idpId: profile.idpId, lastLoginAt: new Date() })
      .onConflictDoUpdate({ target: [ssoIdentities.tenantId, ssoIdentities.provider, ssoIdentities.profileId], set: { lastLoginAt: new Date(), userId: user.id } });
    // What the IdP says about the member: attributes from its claims, roles from its groups (docs/plans/15 §5.4, §5.5).
    await this.attributes.apply(tenant, user.id, 'sso', profile.rawAttributes ?? {});
    await this.roleSync.recordGroups(tenant, user.id, 'sso', profile.groups ?? []);
    const amr = Array.isArray(profile.rawAttributes.amr) ? profile.rawAttributes.amr : [];
    await this.audit.record(tenant.id, { ...actor, id: user.id }, 'member.signed_in_sso', { type: 'user', id: user.id }, { connection: profile.connectionId, amr });

    const session = await this.identity.sessionForMember(tenant, user.id);
    const handoff = randomBytes(24).toString('base64url');
    await this.secrets.put('sso-handoff', handoff, { session, tenantId: tenant.id } as unknown as Record<string, unknown>, HANDOFF_TTL_SECONDS);
    return tenantWebUrl(tenant.domain, `/sign-on?sso=${handoff}`);
  }

  /** The web app exchanges the one-time code for the session (tokens never travel in URLs). */
  async exchange(handoff: string): Promise<{ session: Session; tenant: Tenant | null }> {
    const entry = await this.secrets.take<{ session: Session; tenantId: string | null }>('sso-handoff', handoff ?? '');
    if (!entry) throw new AuthError('The sign-in expired: start again', 400);
    if (!entry.tenantId) return { session: entry.session, tenant: null };
    const tenant = await this.directory.findById(entry.tenantId);
    if (!tenant) throw new AuthError('Unknown institution', 404);
    return { session: entry.session, tenant };
  }
}
