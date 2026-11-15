import { Injectable, Inject, Scope } from "@nestjs/common";
import { eq, sql } from 'drizzle-orm';
import type { Invitation, Tenant } from '@repo/fintivio/schemas';
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
import { AuditWriter } from './audit.writer';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

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

  /** Link to the tenant's own sign-on page (`<tenant>.<BASE_DOMAIN>`), which accepts the invitation. */
  invitationLink(tenant: Tenant, token: string) {
    return tenantWebUrl(tenant.domain, `/sign-on?invitation=${encodeURIComponent(token)}`);
  }

  async createInvitation(email: string, role: string, domain: string, name?: string, roleKeys?: string[]): Promise<Invitation> {
    const tenant = await this.targetTenant(domain);
    const db = this.databases.forTenant(tenant.id);
    const invitedBy = this.auth.user?.email ?? 'system';

    const { invitation, token } = await this.identity.createInvitation(db, { email, name, roleKeys: roleKeys ?? (role ? [role] : []), invitedBy });
    const link = this.invitationLink(tenant, token);

    await this.email.send({
      tenant: tenant.domain,
      to: email,
      subject: `Invitation to join ${tenant.name}`,
      text: `You have been invited to join ${tenant.name}. Accept the invitation: ${link}`,
      html: `<p>Dear user,</p>
<p>You have been invited to join ${escapeHtml(tenant.name)}.</p>
<p><a href="${escapeHtml(link)}">Accept the invitation and set your password</a>. The link is valid for 7 days.</p>
<p>If you did not expect this invitation, please ignore this email.</p>
<p>Best regards,<br>${escapeHtml(tenant.name)} Team</p>`,
    });

    await this.audit.record(tenant.id, { type: this.auth.claims?.kind ?? 'system', id: this.auth.user?.userId, email: this.auth.user?.email },
      'member.invited', { type: 'user', id: (invitation.data as { userId?: string })?.userId, email }, { roles: roleKeys ?? (role ? [role] : []) });

    return invitation;
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
