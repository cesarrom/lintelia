import { Injectable, Inject, Scope } from "@nestjs/common";
import { eq, sql } from 'drizzle-orm';
import type { Invitation, Tenant } from '@repo/lintelia/schemas';
import { sysInvitations } from '../entities/tenants';
import { AbstractService } from './service';
import { tenantWebUrl } from '../constants';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { AUTH_CONTEXT } from '../injector/tokens/auth-context.token';
import type { AuthContext } from '../auth/auth-context';
import { IdentityService } from '../auth/identity.service';
import { TenantDirectory } from './tenant-directory.service';
import { EMAIL_PROVIDER, type EmailProvider } from '../providers/email.provider';
import { ForbiddenError } from '../http/errors';
import { AuditWriter, type AuditActor } from './audit.writer';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Link to the tenant's own sign-on page (`<tenant>.<BASE_DOMAIN>`), which accepts the invitation. */
export const invitationLink = (tenant: Tenant, token: string) => tenantWebUrl(tenant.domain, `/sign-on?invitation=${encodeURIComponent(token)}`);

/**
 * Invite a member (with roles) and e-mail the link: used by invitations in a request and by access changes applied
 * later (approved or scheduled, docs/plans/15 §14). Callers check who may invite whom.
 */
export async function sendMemberInvitation(
  deps: { databases: Databases; identity: IdentityService; email: EmailProvider; audit: AuditWriter },
  tenant: Tenant,
  input: { email: string; name?: string; roleKeys: string[]; source?: 'manual' | 'recovery' },
  actor: AuditActor,
): Promise<Invitation> {
  const db = deps.databases.forTenant(tenant.id);
  const { invitation, token } = await deps.identity.createInvitation(db, { email: input.email, name: input.name, roleKeys: input.roleKeys, invitedBy: actor.email ?? 'system', source: input.source });
  const link = invitationLink(tenant, token);
  await deps.email.send({
    tenant: tenant.domain,
    to: input.email,
    subject: `Invitation to join ${tenant.name}`,
    text: `You have been invited to join ${tenant.name}. Accept the invitation: ${link}`,
    html: `<p>Dear user,</p>
<p>You have been invited to join ${escapeHtml(tenant.name)}.</p>
<p><a href="${escapeHtml(link)}">Accept the invitation and set your password</a>. The link is valid for 7 days.</p>
<p>If you did not expect this invitation, please ignore this email.</p>
<p>Best regards,<br>${escapeHtml(tenant.name)} Team</p>`,
  });
  await deps.audit.record(tenant.id, actor, 'member.invited', { type: 'user', id: (invitation.data as { userId?: string })?.userId, email: input.email }, { roles: input.roleKeys, ...(input.source === 'recovery' ? { recovery: true } : {}) });
  return invitation;
}

/**
 * Invitations of tenant members. Platform staff can invite into any tenant (e.g. the first administrator while
 * onboarding an institution); tenant administrators only into their own tenant.
 */
@Injectable({
  scope: Scope.REQUEST
})
export class InvitationsService extends AbstractService {
  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(AUTH_CONTEXT) private readonly auth: AuthContext,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(TenantDirectory) private readonly directory: TenantDirectory,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) {
    super();
  }

  private async targetTenant(domain: string): Promise<Tenant> {
    const tenant = await this.directory.findByKey(domain);
    if (!tenant) throw new Error('Tenant not found');
    const isOnboardingStaff = this.auth.claims?.kind === 'staff' && !!this.auth.user?.permissions.includes('platform.tenants:create');
    const isTenantInviter = this.auth.tenant?.id === tenant.id && !!this.auth.user?.permissions.includes('members:invite');
    if (!isOnboardingStaff && !isTenantInviter) throw new ForbiddenError('Not allowed to invite users into this tenant');
    return tenant;
  }

  invitationLink(tenant: Tenant, token: string) {
    return invitationLink(tenant, token);
  }

  async createInvitation(email: string, role: string, domain: string, name?: string, roleKeys?: string[]): Promise<Invitation> {
    const tenant = await this.targetTenant(domain);
    const actor = { type: this.auth.claims?.kind ?? 'system', id: this.auth.user?.userId, email: this.auth.user?.email };
    return sendMemberInvitation({ databases: this.databases, identity: this.identity, email: this.email, audit: this.audit }, tenant,
      { email, name, roleKeys: roleKeys ?? (role ? [role] : []) }, actor);
  }

  /** Pending invitation of the given e-mail in the current tenant. */
  async getInvitationByEmail(email: string): Promise<Invitation | null> {
    if (!this.auth.tenant) return null;
    const [invitation] = await this.databases.forTenant(this.auth.tenant.id).select().from(sysInvitations)
      .where(sql`lower(${sysInvitations.email}) = ${email.toLowerCase()}`).limit(1);
    return invitation ?? null;
  }

  async deleteInvitation(id: string) {
    if (!this.auth.tenant) return;
    await this.databases.forTenant(this.auth.tenant.id).delete(sysInvitations).where(eq(sysInvitations.id, id));
  }
}
