import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { cases, publicFormKeys, sysForms } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { CASE_REPOSITORY, ENGINE_CLIENT, EngineClient } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { IdentityService, type Session } from '../auth/identity.service';
import { Throttle } from '../auth/session.store';
import { redis } from '../clients/redis.client';
import { TenantDirectory } from './tenant-directory.service';
import { AuditWriter } from './audit.writer';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, TooManyRequestsError } from '../http/errors';
import { tenantWebUrl } from '../constants';
import { parseDefinition, renderCaseTitle } from '../engine/definition';
import { interpolate } from '../engine/expressions';

const SUBMISSIONS_PER_WINDOW = 20;
const SUBMISSION_WINDOW_SECONDS = 10 * 60;

const normalizeOrigin = (value: string) => {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
};

/**
 * Published (embeddable) forms. Publishing links a form to a published workflow; each verified submission opens a
 * case on it. Public endpoints resolve the tenant from the form's public key (platform table) and then work inside
 * that tenant's row-level-security context.
 */
@Injectable({ scope: Scope.REQUEST })
export class PublicFormsService {
  private readonly throttle = new Throttle(redis());

  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(ENGINE_CLIENT) private readonly engine: EngineClient,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(TenantDirectory) private readonly directory: TenantDirectory,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(TENANT) private readonly tenant: Tenant | null,
    @Inject(USER) private readonly user: User | null,
  ) { }

  // --- members ----------------------------------------------------------------------------------------------------

  embedFor(tenant: Tenant, publicKey: string, formName: string) {
    const url = tenantWebUrl(tenant.domain, `/embed/forms/${publicKey}`);
    const scriptSrc = tenantWebUrl(tenant.domain, '/embed.js');
    const title = formName.replace(/"/g, '&quot;');
    return {
      url,
      script: `<script src="${scriptSrc}" data-fintivio-form="${publicKey}" data-title="${title}" async></script>`,
      iframe: `<iframe src="${url}" title="${title}" style="width:100%;min-height:640px;border:0" loading="lazy"></iframe>`,
    };
  }

  async publish(formId: string, input: { workflowId?: string; allowedOrigins?: string[] }) {
    const tenant = this.tenant!;
    const db = this.databases.forTenant(tenant.id);
    const [form] = await db.select().from(sysForms).where(eq(sysForms.id, formId));
    if (!form) throw new NotFoundError('Form not found');
    if (!input.workflowId) throw new BadRequestError('Choose the workflow that handles submissions');
    if (!(await this.repository.activeVersion(tenant.id, input.workflowId))) throw new ConflictError('The workflow must be published first');
    const allowedOrigins = (input.allowedOrigins ?? []).map((o) => normalizeOrigin(o.trim())).filter(Boolean) as string[];
    if ((input.allowedOrigins ?? []).length !== allowedOrigins.length) throw new BadRequestError('Allowed origins must be URLs like https://www.bank.com');

    const publicKey = form.publicKey ?? `pf_${randomBytes(12).toString('base64url')}`;
    await db.update(sysForms).set({ publicKey, publishedAt: new Date(), allowedOrigins, workflowId: input.workflowId }).where(eq(sysForms.id, formId));
    await this.databases.platform.insert(publicFormKeys).values({ key: publicKey, tenantId: tenant.id, formId }).onConflictDoNothing();
    await this.audit.record(tenant.id, { type: 'member', id: this.user?.userId, email: this.user?.email }, 'form.published', { type: 'form', id: formId, name: form.name }, { workflowId: input.workflowId, allowedOrigins });
    return { publicKey, allowedOrigins, workflowId: input.workflowId, embed: this.embedFor(tenant, publicKey, form.name) };
  }

  async unpublish(formId: string) {
    const tenant = this.tenant!;
    const db = this.databases.forTenant(tenant.id);
    const [form] = await db.select().from(sysForms).where(eq(sysForms.id, formId));
    if (!form) throw new NotFoundError('Form not found');
    if (form.publicKey) await this.databases.platform.delete(publicFormKeys).where(eq(publicFormKeys.key, form.publicKey));
    await db.update(sysForms).set({ publicKey: null, publishedAt: null }).where(eq(sysForms.id, formId));
    await this.audit.record(tenant.id, { type: 'member', id: this.user?.userId, email: this.user?.email }, 'form.unpublished', { type: 'form', id: formId, name: form.name });
    return { unpublished: true };
  }

  async publication(formId: string) {
    const tenant = this.tenant!;
    const [form] = await this.databases.forTenant(tenant.id).select().from(sysForms).where(eq(sysForms.id, formId));
    if (!form) throw new NotFoundError('Form not found');
    if (!form.publicKey) return { published: false };
    return { published: true, publicKey: form.publicKey, allowedOrigins: form.allowedOrigins, workflowId: form.workflowId, publishedAt: form.publishedAt, embed: this.embedFor(tenant, form.publicKey, form.name) };
  }

  // --- public -----------------------------------------------------------------------------------------------------

  private async resolve(publicKey: string) {
    const [entry] = await this.databases.platform.select().from(publicFormKeys).where(eq(publicFormKeys.key, publicKey)).limit(1);
    if (!entry) throw new NotFoundError('Form not found');
    const tenant = await this.directory.findById(entry.tenantId);
    if (!tenant || tenant.status !== 'active') throw new NotFoundError('Form not found');
    const [form] = await this.databases.forTenant(tenant.id).select().from(sysForms).where(eq(sysForms.id, entry.formId));
    if (!form || form.publicKey !== publicKey || !form.workflowId) throw new NotFoundError('Form not found');
    return { tenant, form };
  }

  /**
   * The embedding page's origin (sent by the embed page as `X-Embed-Origin`, from `ancestorOrigins`/referrer) must be
   * allowed. Opening the hosted form directly on the institution's own host is always allowed.
   * Browsers additionally enforce `frame-ancestors` on the embed page itself (see apps/web vite.config.ts).
   */
  private checkOrigin(tenant: Tenant, allowedOrigins: string[], embedOrigin: string | null) {
    if (!embedOrigin || embedOrigin === 'null') return;
    const origin = normalizeOrigin(embedOrigin);
    const own = normalizeOrigin(tenantWebUrl(tenant.domain, '/'));
    if (origin && (origin === own || allowedOrigins.includes(origin))) return;
    throw new ForbiddenError('This form cannot be embedded on this site');
  }

  async getPublic(publicKey: string, embedOrigin: string | null) {
    const { tenant, form } = await this.resolve(publicKey);
    this.checkOrigin(tenant, form.allowedOrigins, embedOrigin);
    return {
      name: form.name,
      description: form.description,
      config: form.config,
      tenant: { domain: tenant.domain, name: tenant.name, logoUrl: tenant.logoUrl, pallette: tenant.pallette },
    };
  }

  async embedPolicy(publicKey: string) {
    const { tenant, form } = await this.resolve(publicKey);
    return { frameAncestors: [normalizeOrigin(tenantWebUrl(tenant.domain, '/')), ...form.allowedOrigins].filter(Boolean) };
  }

  /** Anonymous submission: creates a draft case and e-mails a code; the workflow starts once the e-mail is confirmed. */
  async submit(publicKey: string, input: { email?: string; answers?: Record<string, unknown> }, meta: { ip: string; embedOrigin: string | null }) {
    const { tenant, form } = await this.resolve(publicKey);
    this.checkOrigin(tenant, form.allowedOrigins, meta.embedOrigin);
    if ((await this.throttle.hit(`form-submit:${publicKey}:${meta.ip}`, SUBMISSION_WINDOW_SECONDS)) > SUBMISSIONS_PER_WINDOW) {
      throw new TooManyRequestsError('Too many submissions, please try again later');
    }
    const { consent, ...answers } = (input.answers ?? {}) as Record<string, unknown> & { consent?: { privacyNotice?: string } };
    const acceptedAt = new Date().toISOString();
    const consents = consent?.privacyNotice ? [{ document: 'privacy_notice', version: String(consent.privacyNotice), acceptedAt, channel: 'form' }] : [];
    const email = String(input.email ?? answers.email ?? '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BadRequestError('A valid e-mail address is required');
    const name = String(answers.fullName ?? answers.name ?? '').trim() || undefined;

    const client = await this.identity.ensureClient(tenant, email, name);
    const version = await this.repository.activeVersion(tenant.id, form.workflowId!);
    if (!version) throw new ConflictError('This form is not accepting submissions right now');
    const kase = await this.repository.createCase(tenant.id, {
      title: renderCaseTitle(version.yaml, { ...answers, email }, name ?? email, interpolate),
      workflowId: form.workflowId!,
      workflowVersion: version.version,
      status: 'draft',
      applicantId: client.id,
      applicantEmail: client.email,
      applicantName: name ?? client.name,
      initiatedByType: 'public',
      initiatedByEmail: email,
      source: `form:${form.id}`,
      data: { ...answers, email },
      clientVisibility: parseDefinition(version.yaml).clientVisibility,
      consents,
    });
    await this.audit.record(tenant.id, { type: 'public', email }, 'case.drafted', { type: 'case', id: kase.id, reference: kase.reference }, { form: form.name, origin: meta.embedOrigin }, kase.id);
    await this.identity.startOtp(tenant, email);
    return { caseId: kase.id, reference: kase.reference, status: 'draft' as const };
  }

  /**
   * Submit the applicant's draft applications once their e-mail is confirmed (by this form or by signing in with a
   * code): the workflow of each starts now. Drafts older than a day are left alone.
   */
  async submitDrafts(tenant: Tenant, client: { userId: string; email: string }) {
    const db = this.databases.forTenant(tenant.id);
    const drafts = await db.select().from(cases).where(and(
      eq(cases.applicantId, client.userId), eq(cases.status, 'draft'), gt(cases.createdAt, new Date(Date.now() - 24 * 3600 * 1000)),
    ));
    for (const kase of drafts) {
      await this.repository.updateCase(tenant.id, kase.id, { status: 'submitted' });
      await this.audit.record(tenant.id, { type: 'client', id: client.userId, email: client.email }, 'case.submitted', { type: 'case', id: kase.id }, {}, kase.id);
      await this.engine.start(tenant.id, kase.id);
    }
    return drafts.map((d) => d.id);
  }

  /** Confirm the applicant's e-mail with the code: signs them in (client) and submits the case. */
  async verify(publicKey: string, input: { caseId: string; email: string; code: string }): Promise<{ session: Session; tenant: Tenant; caseId: string; reference: string }> {
    const { tenant } = await this.resolve(publicKey);
    const { created: _created, ...session } = await this.identity.verifyOtp(tenant, input.email, input.code);
    const kase = await this.repository.getCase(tenant.id, input.caseId);
    if (!kase || kase.applicantId !== session.user.userId) throw new NotFoundError('Application not found');
    await this.submitDrafts(tenant, session.user);
    return { session, tenant, caseId: kase.id, reference: kase.reference };
  }
}

