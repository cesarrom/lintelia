import { Inject, Injectable } from '@nestjs/common';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { IdentityService } from '../auth/identity.service';
import { EMAIL_PROVIDER, type EmailProvider } from '../providers/email.provider';
import { AuditWriter } from '../services/audit.writer';
import { PlatformAuditWriter } from '../services/platform-audit.writer';
import { TenantDirectory } from '../services/tenant-directory.service';
import { sendMemberInvitation } from '../services/invitations.service';
import { BadRequestError, NotFoundError } from '../http/errors';
import { AccessNotifier } from './notify';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Staff recovery of an institution's access (docs/plans/15 §14): when an institution locked itself out (its only
 * administrators left, its identity provider is gone), platform staff holding `platform.tenants:recover` restore an
 * administrator, after verifying the request out of band (the support ticket is recorded). It is an invitation with the
 * `admin` role as a local account (kept by IdP syncs), bypassing approvals; written to the platform audit log and to
 * the institution's own; every administrator of the institution is told. Staff still never see institution data.
 */
@Injectable()
export class AccessRecovery {
  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(TenantDirectory) private readonly directory: TenantDirectory,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(PlatformAuditWriter) private readonly platformAudit: PlatformAuditWriter,
    @Inject(AccessNotifier) private readonly notifier: AccessNotifier,
  ) { }

  async recover(staff: { id: string; email: string }, tenantKey: string, input: { email?: string; name?: string; reason?: string; ticket?: string }) {
    const tenant = await this.directory.findByKey(tenantKey);
    if (!tenant) throw new NotFoundError('Institution not found');
    if (tenant.status !== 'active') throw new BadRequestError('Reactivate the institution first');
    const email = input.email?.trim() ?? '';
    if (!EMAIL.test(email)) throw new BadRequestError('The e-mail address of the administrator to restore is required');
    const reason = input.reason?.trim() ?? '';
    if (reason.length < 10) throw new BadRequestError('Say why access is restored (at least 10 characters)');
    const ticket = input.ticket?.trim() ?? '';
    if (!ticket) throw new BadRequestError('The support ticket where the request was verified is required');

    const administrators = await this.notifier.recipients(tenant.id);
    const actor = { type: 'staff', id: staff.id, email: staff.email };
    await sendMemberInvitation({ databases: this.databases, identity: this.identity, email: this.email, audit: this.audit }, tenant,
      { email, name: input.name, roleKeys: ['admin'], source: 'recovery' }, actor);
    await this.audit.record(tenant.id, actor, 'access.recovered', { type: 'user', email }, { reason, ticket });
    await this.platformAudit.record(actor, 'tenant.access_recovered', { type: 'tenant', id: tenant.id, name: tenant.name }, tenant, { email, reason, ticket });
    await this.notifier.send(tenant, {
      to: [...new Set([...administrators, email.toLowerCase()])],
      subject: 'Platform support restored an administrator',
      lines: [
        `Lintelia support (${staff.email}) invited ${email} as an administrator of ${tenant.name}, after verifying the request in ticket ${ticket}.`,
        `Reason: ${reason}`,
        'If you did not ask for this, contact Lintelia support at once.',
      ],
      link: '/app/users',
    });
    return { tenant: tenant.domain, email, role: 'admin', ticket };
  }
}
