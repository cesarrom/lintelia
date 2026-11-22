import { Inject, Injectable } from '@nestjs/common';
import type { Tenant } from '@repo/lintelia/schemas';
import { tenantSecurityPolicies } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { EMAIL_PROVIDER, type EmailProvider } from '../providers/email.provider';
import { tenantWebUrl } from '../constants';
import { membersWithAccess } from './catalog';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Who administers access: members holding one of these are told about privileged access changes. */
export const ADMINISTRATOR_PERMISSIONS = ['roles:manage', 'security:manage'];

/**
 * E-mails about access (docs/plans/15 §14): every privileged change reaches the institution's administrators and the
 * extra addresses of its security policy (e.g. the security team). Messages say what changed and who did it, never
 * secrets; the details are in *Access changes* and the audit log.
 */
@Injectable()
export class AccessNotifier {
  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) { }

  async recipients(tenantId: string) {
    const db = this.databases.forTenant(tenantId);
    const administrators = (await membersWithAccess(db)).filter((m) => ADMINISTRATOR_PERMISSIONS.some((p) => m.permissions.includes(p))).map((m) => m.email);
    const [policy] = await db.select({ notify: tenantSecurityPolicies.accessNotify }).from(tenantSecurityPolicies).limit(1);
    return [...new Set([...administrators, ...(policy?.notify ?? [])].map((e) => e.toLowerCase()))];
  }

  /** One message to every administrator (and the policy's extra addresses), or to the given addresses only. */
  async send(tenant: Tenant, message: { subject: string; lines: string[]; to?: string[]; link?: string }) {
    const to = message.to ?? await this.recipients(tenant.id);
    if (!to.length) return;
    const link = tenantWebUrl(tenant.domain, message.link ?? '/app/access-changes');
    await this.email.send({
      tenant: tenant.domain,
      to,
      subject: `[${tenant.name}] ${message.subject}`,
      text: [...message.lines, '', `Details: ${link}`].join('\n'),
      html: `${message.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}<p><a href="${escapeHtml(link)}">See the details</a></p>`,
    });
  }
}
