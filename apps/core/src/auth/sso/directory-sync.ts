import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { roles, ssoOrganizationIndex, tenantSsoSettings, userRoles, users } from '../../entities';
import type { Databases } from '../../clients/database.client';
import { DATABASES } from '../../injector/tokens/databases.token';
import { redis } from '../../clients/redis.client';
import { env } from '../../constants';
import { AuditWriter } from '../../services/audit.writer';
import { TenantDirectory } from '../../services/tenant-directory.service';
import { IdentityService } from '../identity.service';
import { SSO_BROKER, type DirectoryEvent, type SsoBroker } from './broker';

const DIRECTORY_ACTOR = { type: 'directory', email: 'directory-sync' };

/**
 * Directory sync (FIA-07, docs/plans/02): the institution's IdP provisions and deprovisions members through the
 * broker's SCIM directory; we poll the broker's events (WorkOS recommends the Events API over webhooks for
 * reliability) and apply them: create or update members (default roles of just-in-time provisioning), deactivate them
 * and end their sessions. One pass per organization at a time (Redis lock), the cursor is kept per institution.
 */
@Injectable()
export class DirectorySync implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(SSO_BROKER) private readonly broker: SsoBroker,
    @Inject(TenantDirectory) private readonly directory: TenantDirectory,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  onModuleInit() {
    if (env.DIRECTORY_SYNC_INTERVAL_SECONDS <= 0) return;
    this.timer = setInterval(() => void this.syncAll().catch((error) => console.error('directory sync failed', error.message)), env.DIRECTORY_SYNC_INTERVAL_SECONDS * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async syncAll() {
    const organizations = await this.databases.platform.select().from(ssoOrganizationIndex);
    for (const { organizationId, tenantId } of organizations) {
      const lock = await redis().send('SET', [`directory-sync:${organizationId}`, '1', 'EX', '60', 'NX']);
      if (!lock) continue;
      try {
        await this.syncTenant(tenantId, organizationId);
      } finally {
        await redis().del(`directory-sync:${organizationId}`);
      }
    }
  }

  async syncTenant(tenantId: string, organizationId: string) {
    const tenant = await this.directory.findById(tenantId);
    if (!tenant || tenant.status !== 'active') return;
    const db = this.databases.forTenant(tenantId);
    const [settings] = await db.select().from(tenantSsoSettings).limit(1);
    if (!settings || settings.organizationId !== organizationId) return;
    let cursor = settings.eventsCursor ?? null;
    for (let page = 0; page < 20; page++) {
      const { events, cursor: next } = await this.broker.directoryEvents(organizationId, cursor);
      for (const event of events) await this.apply(tenantId, settings, event);
      if (next !== cursor) {
        cursor = next;
        await db.update(tenantSsoSettings).set({ eventsCursor: cursor }).where(eq(tenantSsoSettings.id, settings.id));
      }
      if (events.length < 100) break;
    }
  }

  private async apply(tenantId: string, settings: typeof tenantSsoSettings.$inferSelect, event: DirectoryEvent) {
    const db = this.databases.forTenant(tenantId);
    const email = event.user.email.trim().toLowerCase();
    if (!email) return;
    const active = event.type !== 'dsync.user.deleted' && event.user.state === 'active';
    const name = [event.user.firstName, event.user.lastName].filter(Boolean).join(' ') || email;
    const [existing] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (existing && existing.kind !== 'member') return;
    if (!existing) {
      if (!active) return;
      const [created] = await db.insert(users).values({ email, name, kind: 'member', status: 'active' }).returning();
      if (settings.jitDefaultRoles.length) {
        const roleRows = await db.select({ id: roles.id }).from(roles).where(inArray(roles.key, settings.jitDefaultRoles));
        if (roleRows.length) await db.insert(userRoles).values(roleRows.map((r) => ({ userId: created.id, roleId: r.id }))).onConflictDoNothing();
      }
      await this.audit.record(tenantId, DIRECTORY_ACTOR, 'member.provisioned', { type: 'user', id: created.id, email }, { directoryUser: event.user.id, roles: settings.jitDefaultRoles });
      return;
    }
    if (active) {
      if (existing.status !== 'active' || existing.name !== name) {
        await db.update(users).set({ status: 'active', name }).where(eq(users.id, existing.id));
        await this.audit.record(tenantId, DIRECTORY_ACTOR, existing.status === 'active' ? 'member.updated' : 'member.reactivated', { type: 'user', id: existing.id, email }, { directoryUser: event.user.id });
      }
      return;
    }
    if (existing.status !== 'disabled') {
      await db.update(users).set({ status: 'disabled' }).where(eq(users.id, existing.id));
      await this.identity.revokeUserSessions('member', tenantId, existing.id);
      await this.audit.record(tenantId, DIRECTORY_ACTOR, 'member.deprovisioned', { type: 'user', id: existing.id, email }, { directoryUser: event.user.id, event: event.type });
    }
  }
}
