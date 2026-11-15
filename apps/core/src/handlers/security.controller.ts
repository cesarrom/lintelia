import { Controller, Get, Inject, Put, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import type { Tenant, User } from '@repo/fintivio/schemas';
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
import { handle } from '../http/respond';

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
  ) { }

  @Require('security:manage')
  @Get('/policy')
  policy(@Res() ctx: Context) {
    return handle(ctx, () => this.identity.securityPolicy(this.tenant.id), 'Failed to load the policy');
  }

  @Require('security:manage')
  @Put('/policy')
  update(@Res() ctx: Context) {
    return handle(ctx, async () => {
      const body = await this.request.json<{ requireMfa?: unknown }>();
      if (typeof body.requireMfa !== 'boolean') throw new BadRequestError('requireMfa (true/false) is required');
      const before = await this.identity.securityPolicy(this.tenant.id);
      await this.databases.forTenant(this.tenant.id).insert(tenantSecurityPolicies).values({ requireMfa: body.requireMfa, updatedByEmail: this.user.email })
        .onConflictDoUpdate({ target: tenantSecurityPolicies.tenantId, set: { requireMfa: body.requireMfa, updatedByEmail: this.user.email } });
      if (before.requireMfa !== body.requireMfa) {
        await this.audit.record(this.tenant.id, { type: this.user.kind, id: this.user.userId, email: this.user.email }, 'security.policy_changed', { type: 'tenant', id: this.tenant.id }, { requireMfa: body.requireMfa });
      }
      return this.identity.securityPolicy(this.tenant.id);
    }, 'Failed to update the policy');
  }
}
