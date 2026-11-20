import { Controller, Get, Inject, Put, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import type { Tenant, User } from '@repo/lintelia/schemas';
import { Require } from '../auth/access';
import { IdentityService } from '../auth/identity.service';
import { tenantSecurityPolicies } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { AuditWriter } from '../services/audit.writer';
import { BadRequestError } from '../http/errors';
import { handle, respondToChange } from '../http/respond';
import { AccessChanges, actorOf } from '../access/changes';

/** The institution's security policy (FIA-08): `requireMfa` for password sign-ins of members (default on). */
@Controller({ path: '/security', scope: Scope.REQUEST })
export class SecurityHandler {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
    @Inject(AccessChanges) private readonly changes: AccessChanges,
  ) { }

  @Require('security:manage')
  @Get('/policy')
  policy(@Res() ctx: Context) {
    return handle(ctx, () => this.identity.securityPolicy(this.tenant.id), 'Failed to load the policy');
  }

  /**
   * `requireMfa` applies at once; `accessApproval` / `accessNotify` (who approves and hears about access changes) are
   * themselves an access change: switching approvals off waits for a second administrator while they are on.
   */
  @Require('security:manage')
  @Put('/policy')
  update(@Res() ctx: Context) {
    return respondToChange(ctx, async () => {
      const body = await this.request.json<{ requireMfa?: unknown; accessApproval?: unknown; accessNotify?: unknown; readAudit?: unknown; effectiveAt?: string }>();
      const touchesAccess = body.accessApproval !== undefined || body.accessNotify !== undefined;
      if (body.readAudit !== undefined) {
        if (typeof body.readAudit !== 'boolean') throw new BadRequestError('readAudit must be true or false');
        const before = await this.identity.securityPolicy(this.tenant.id);
        await this.databases.forTenant(this.tenant.id).insert(tenantSecurityPolicies).values({ readAudit: body.readAudit, updatedByEmail: this.user.email })
          .onConflictDoUpdate({ target: tenantSecurityPolicies.tenantId, set: { readAudit: body.readAudit, updatedByEmail: this.user.email } });
        if (before.readAudit !== body.readAudit) {
          await this.audit.record(this.tenant.id, { type: this.user.kind, id: this.user.userId, email: this.user.email }, 'security.policy_changed', { type: 'tenant', id: this.tenant.id }, { readAudit: body.readAudit });
        }
      }
      if (body.requireMfa === undefined && !touchesAccess && body.readAudit === undefined) throw new BadRequestError('requireMfa (true/false) is required');
      if (body.requireMfa !== undefined) {
        if (typeof body.requireMfa !== 'boolean') throw new BadRequestError('requireMfa (true/false) is required');
        const before = await this.identity.securityPolicy(this.tenant.id);
        await this.databases.forTenant(this.tenant.id).insert(tenantSecurityPolicies).values({ requireMfa: body.requireMfa, updatedByEmail: this.user.email })
          .onConflictDoUpdate({ target: tenantSecurityPolicies.tenantId, set: { requireMfa: body.requireMfa, updatedByEmail: this.user.email } });
        if (before.requireMfa !== body.requireMfa) {
          await this.audit.record(this.tenant.id, { type: this.user.kind, id: this.user.userId, email: this.user.email }, 'security.policy_changed', { type: 'tenant', id: this.tenant.id }, { requireMfa: body.requireMfa });
        }
      }
      if (!touchesAccess) return { status: 'applied', change: null, result: null };
      return this.changes.submit(this.tenant, actorOf(this.user), 'security.access_policy',
        { ...(body.accessApproval !== undefined ? { approval: body.accessApproval } : {}), ...(body.accessNotify !== undefined ? { notify: body.accessNotify } : {}) },
        { effectiveAt: body.effectiveAt });
    }, () => this.identity.securityPolicy(this.tenant.id), 'Failed to update the policy');
  }
}
