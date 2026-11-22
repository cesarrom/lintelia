import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import jsonata from 'jsonata';
import { clientAppDefinitionSchema, validateClientApp, type Tenant, type User } from '@repo/lintelia/schemas';
import { clientApps, clientAppVersions, sysWorkflows, users, workflowVersions } from '../entities';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { CASE_REPOSITORY } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { AuditWriter, type AuditActor } from '../services/audit.writer';
import { BadRequestError, ForbiddenError, NotFoundError, UnprocessableError } from '../http/errors';
import { tenantWebUrl } from '../constants';
import { CLIENT_APP_TEMPLATES, blankApp, installClientAppTemplate, publishVersion, saveDraft } from './templates';
import { loadApp, resolveSources } from './runtime-data';

/** JSONata syntax check for the app's expressions. */
export function checkExpression(source: string): string | null {
  try {
    jsonata(source);
    return null;
  } catch (error) {
    return (error as { message?: string }).message ?? 'invalid expression';
  }
}

/** The studio (docs/plans/11 §9): the draft of the client app, validation, versions, templates and preview. */
@Injectable({ scope: Scope.REQUEST })
export class ClientAppsService {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private get db() {
    return this.repository.db(this.tenant.id);
  }

  private get actor(): AuditActor {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  /** Workflows the app may reference, with their published state. */
  private async workflows() {
    const rows = await this.db.select({ id: sysWorkflows.id, name: sysWorkflows.name }).from(sysWorkflows);
    const active = new Set((await this.db.select({ id: workflowVersions.workflowId }).from(workflowVersions).where(eq(workflowVersions.status, 'active'))).map((r) => r.id));
    return rows.map((w) => ({ ...w, active: active.has(w.id) })).sort((a, b) => a.name.localeCompare(b.name));
  }

  private async errors(definition: unknown) {
    return validateClientApp(definition, { workflows: await this.workflows(), checkExpression });
  }

  /** The app (a blank draft is created on first visit), its versions and the draft's problems. */
  async current() {
    const app = (await loadApp(this.db)) ?? await saveDraft(this.db, blankApp(), this.user.email);
    const versions = await this.db.select({ version: clientAppVersions.version, publishedAt: clientAppVersions.publishedAt, publishedBy: clientAppVersions.publishedBy })
      .from(clientAppVersions).where(eq(clientAppVersions.appId, app.id)).orderBy(desc(clientAppVersions.version));
    const workflows = await this.workflows();
    return {
      id: app.id, name: app.name, draft: app.draft, activeVersion: app.activeVersion, versions,
      updatedAt: app.updatedAt, updatedBy: app.updatedBy,
      errors: validateClientApp(app.draft, { workflows, checkExpression }),
      workflows,
      portalUrl: tenantWebUrl(this.tenant.domain, '/portal'),
    };
  }

  async saveDraft(body: { definition?: unknown }) {
    const definition = body?.definition;
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new BadRequestError('definition must be an object');
    await saveDraft(this.db, definition as Record<string, unknown>, this.user.email);
    return this.current();
  }

  async validate(body?: { definition?: unknown }) {
    const app = await loadApp(this.db);
    return { errors: await this.errors(body?.definition ?? app?.draft ?? {}) };
  }

  async publish() {
    const app = await loadApp(this.db);
    if (!app) throw new NotFoundError('Nothing to publish yet');
    const errors = await this.errors(app.draft);
    if (errors.length) throw new UnprocessableError('The app cannot be published yet', errors);
    const definition = clientAppDefinitionSchema.parse(app.draft);
    const version = await publishVersion(this.db, app.id, definition as unknown as Record<string, unknown>, this.user.email);
    await this.audit.record(this.tenant.id, this.actor, 'client_app.published', { type: 'client_app', id: app.id, name: app.name }, { version });
    return this.current();
  }

  /** Make an earlier version the one clients get (roll back), without touching the draft. */
  async activate(version: number) {
    const app = await loadApp(this.db);
    if (!app) throw new NotFoundError('No app');
    const [row] = await this.db.select({ version: clientAppVersions.version }).from(clientAppVersions).where(and(eq(clientAppVersions.appId, app.id), eq(clientAppVersions.version, version))).limit(1);
    if (!row) throw new NotFoundError(`Version ${version} does not exist`);
    await this.db.update(clientApps).set({ activeVersion: version }).where(eq(clientApps.id, app.id));
    await this.audit.record(this.tenant.id, this.actor, 'client_app.activated', { type: 'client_app', id: app.id, name: app.name }, { version, previous: app.activeVersion });
    return this.current();
  }

  async version(version: number) {
    const app = await loadApp(this.db);
    const [row] = app ? await this.db.select().from(clientAppVersions).where(and(eq(clientAppVersions.appId, app.id), eq(clientAppVersions.version, version))).limit(1) : [];
    if (!row) throw new NotFoundError(`Version ${version} does not exist`);
    return { version: row.version, definition: row.definition, publishedAt: row.publishedAt, publishedBy: row.publishedBy };
  }

  templates() {
    return CLIENT_APP_TEMPLATES;
  }

  /**
   * Replace the draft with a template. The template's journey workflows are created (and published when the caller may
   * publish workflows); the app itself stays a draft until it is published.
   */
  async installTemplate(body: { template?: string; connections?: Record<string, string>; parameters?: Record<string, string> }) {
    const template = String(body?.template ?? '');
    if (!CLIENT_APP_TEMPLATES.some((t) => t.id === template)) throw new BadRequestError(`Unknown template "${template}"`);
    const publishWorkflows = this.user.permissions.includes('workflows:publish');
    if (template !== 'blank' && !this.user.permissions.includes('workflows:manage')) throw new ForbiddenError('Installing this template creates workflows (workflows:manage)');
    // Its functions are called by the other workflows, which only works once they are published.
    if (template === 'dealer-finance' && !publishWorkflows) throw new ForbiddenError('Installing this template publishes workflows (workflows:publish)');
    const result = await installClientAppTemplate(this.db, {
      template, by: this.user.email, publish: false, publishWorkflows, institution: this.tenant.name,
      connections: body?.connections && typeof body.connections === 'object' ? body.connections : undefined,
      parameters: body?.parameters && typeof body.parameters === 'object' ? body.parameters : undefined,
    });
    await this.audit.record(this.tenant.id, this.actor, 'client_app.template_installed', { type: 'client_app', id: result.appId }, { template, workflows: Object.keys(result.workflows) });
    return this.current();
  }

  /**
   * Data of a real client as the draft (or the given definition) would show it: the studio's "preview as". Reading a
   * client's data is audited.
   */
  async preview(body: { clientId?: string; sources?: string[]; definition?: unknown }) {
    if (!this.user.permissions.includes('clients:read')) throw new ForbiddenError('Previewing as a client needs clients:read');
    const app = await loadApp(this.db);
    const parsed = clientAppDefinitionSchema.safeParse(body?.definition ?? app?.draft ?? blankApp());
    if (!parsed.success) throw new BadRequestError('The draft is not a valid app yet');
    const clientId = String(body?.clientId ?? '');
    const [client] = clientId ? await this.db.select({ id: users.id, kind: users.kind }).from(users).where(eq(users.id, clientId)).limit(1) : [];
    if (!client || client.kind !== 'client') throw new NotFoundError('Client not found');
    const sources = Array.isArray(body?.sources) ? body!.sources!.map(String) : ['me'];
    const result = await resolveSources(this.db, clientId, parsed.data, sources);
    if ('error' in result) throw new BadRequestError(String(result.error));
    await this.audit.record(this.tenant.id, this.actor, 'client_app.previewed', { type: 'user', id: clientId }, { sources });
    return result.data;
  }
}
