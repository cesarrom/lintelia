import { Inject, Injectable, Scope } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { PLATFORM_ROLES, type User } from '@repo/fintivio/schemas';
import { platformUsers } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { USER } from '../injector/tokens/user.token';
import { IdentityService } from '../auth/identity.service';
import { PlatformAuditWriter } from './platform-audit.writer';
import { BadRequestError, ForbiddenError, NotFoundError } from '../http/errors';

/** Platform staff accounts and their platform roles (`platform.staff:manage`). */
@Injectable({ scope: Scope.REQUEST })
export class PlatformStaffService {
  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(PlatformAuditWriter) private readonly audit: PlatformAuditWriter,
    @Inject(USER) private readonly user: User,
  ) { }

  private get actor() {
    return { type: 'staff', id: this.user.userId, email: this.user.email };
  }

  private validRoles(roles: unknown) {
    const list = Array.isArray(roles) ? roles.map(String) : [];
    const unknown = list.filter((role) => !PLATFORM_ROLES.some((r) => r.key === role));
    if (!list.length || unknown.length) throw new BadRequestError(`Platform roles must be some of: ${PLATFORM_ROLES.map((r) => r.key).join(', ')}`);
    // Only platform administrators hand out the platform administrator role.
    if (list.includes('platform_admin') && !(this.user.platformRoles ?? []).includes('platform_admin')) {
      throw new ForbiddenError('Only platform administrators can grant platform_admin');
    }
    return list;
  }

  async list() {
    const rows = await this.databases.platform.select().from(platformUsers).orderBy(asc(platformUsers.email));
    return rows.map((r) => ({ id: r.id, email: r.email, name: r.name, roles: r.roles, status: r.status, createdAt: r.createdAt }));
  }

  async invite(input: { email?: string; name?: string; roles?: string[] }) {
    const roles = this.validRoles(input.roles);
    const row = await this.identity.inviteStaff({ email: input.email ?? '', name: input.name, roles });
    await this.audit.record(this.actor, 'staff.invited', { type: 'staff', id: row.id, email: row.email }, null, { roles });
    return { id: row.id, email: row.email, name: row.name, roles: row.roles, status: row.status };
  }

  async update(staffId: string, input: { roles?: string[]; status?: 'active' | 'disabled' }) {
    if (staffId === this.user.userId) throw new ForbiddenError('You cannot change your own staff account');
    const [current] = await this.databases.platform.select().from(platformUsers).where(eq(platformUsers.id, staffId));
    if (!current) throw new NotFoundError('Staff member not found');
    const changes: Partial<typeof platformUsers.$inferInsert> = {};
    if (input.roles) changes.roles = this.validRoles(input.roles);
    if (input.status === 'active' || input.status === 'disabled') changes.status = input.status;
    const [row] = await this.databases.platform.update(platformUsers).set(changes).where(eq(platformUsers.id, staffId)).returning();
    if (changes.status === 'disabled' || changes.roles) await this.identity.revokeUserSessions('staff', null, staffId);
    await this.audit.record(this.actor, changes.status === 'disabled' ? 'staff.disabled' : 'staff.updated', { type: 'staff', id: staffId, email: row.email }, null, { roles: row.roles, status: row.status });
    return { id: row.id, email: row.email, name: row.name, roles: row.roles, status: row.status };
  }
}
