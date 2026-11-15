import type { Tenant } from '@repo/fintivio/schemas';
import type { EmailProvider } from '../providers/email.provider';
import { tenantWebUrl } from '../constants';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Branded e-mails sent on behalf of an institution (to applicants and to its staff). */
export class Notifier {
  constructor(private readonly email: EmailProvider) { }

  portalUrl(tenant: Tenant, caseId?: string) {
    return tenantWebUrl(tenant.domain, caseId ? `/portal/cases/${caseId}` : '/portal');
  }

  /**
   * Where an applicant answers a request. Cases with `clientVisibility: requests_only` (investigations) are never shown
   * to the client, so links and wording point to the neutral request list instead of the case.
   */
  requestLink(tenant: Tenant, kase: { id: string; reference: string; clientVisibility?: string | null }) {
    if (kase.clientVisibility === 'requests_only') {
      return { subject: 'We need some information from you', label: 'Open your requests', url: tenantWebUrl(tenant.domain, '/portal/requests') };
    }
    return { subject: `Action needed on your application ${kase.reference}`, label: 'Open your application', url: this.portalUrl(tenant, kase.id) };
  }

  async send(tenant: Tenant, to: string, subject: string, paragraphs: string[], action?: { label: string; url: string }) {
    const text = [...paragraphs, action ? `${action.label}: ${action.url}` : ''].filter(Boolean).join('\n\n');
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
  <div style="background:${tenant.pallette.primary};color:#fff;padding:16px 24px;font-size:18px">${escapeHtml(tenant.name)}</div>
  <div style="padding:24px">${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
  ${action ? `<p><a href="${escapeHtml(action.url)}" style="background:${tenant.pallette.accent};color:#fff;padding:10px 16px;text-decoration:none;border-radius:4px">${escapeHtml(action.label)}</a></p>` : ''}</div>
  <div style="padding:12px 24px;color:#666;font-size:12px">This is an automated message from ${escapeHtml(tenant.name)}.</div>
</div>`;
    return this.email.send({ tenant: tenant.domain, to, subject, text, html });
  }
}
