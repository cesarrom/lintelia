import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import {
  SOURCE_PERMISSIONS, TENANT_PERMISSION_IDS, backOfficeDefinitionSchema, backOfficePageSources, resolvePermissions, satisfiesAccessRule, sourceFamily,
  validateBackOffice, widgetsSources, type BackOfficeDefinition, type Tenant, type User,
} from '@repo/fintivio/schemas';
import { clientApps, clientAppVersions, roles, sysWorkflows, workflowVersions } from '../entities';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { TENANT_CONNECTION } from '../injector/tokens/tenant-connection.token';
import type { TenantDatabase } from '../clients/database.client';
import { AuditWriter, type AuditActor } from '../services/audit.writer';
import { BadRequestError, ForbiddenError, NotFoundError, UnprocessableError } from '../http/errors';
import { AccessChanges, actorOf } from '../access/changes';
import { BACK_OFFICE_TEMPLATES, ensureAuthorityLimitAttribute, ensureFeeWaiverPermission, ensureFeeWaiverWorkflow, feeWaiversBackOffice } from './templates';
import { checkExpression } from '../client-apps/studio.service';
import { activeCustomKeys, grantablePermissionIds, tenantCatalog } from '../access/catalog';
import type { RuleSubject } from '../access/rules';
import { blankBackOffice, loadBackOffice, publishBackOffice, pruneBackOffice, saveBackOfficeDraft } from './store';

/**
 * The studio's back-office mode (docs/plans/16 §5.9): the draft of the institution's own back-office screens,
 * validation, publication, versions and rollback; "preview as" a set of roles and attributes; and the access report —
 * what each role gets, and where a role would see a widget it cannot fill.
 */
@Injectable({ scope: Scope.REQUEST })
export class BackOfficeStudioService {
  constructor(
    @Inject(TENANT_CONNECTION) private readonly db: TenantDatabase,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(AccessChanges) private readonly changes: AccessChanges,
  ) { }

  private get actor(): AuditActor {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  private async workflows() {
    const rows = await this.db.select({ id: sysWorkflows.id, name: sysWorkflows.name }).from(sysWorkflows);
    const active = new Set((await this.db.select({ id: workflowVersions.workflowId }).from(workflowVersions).where(eq(workflowVersions.status, 'active'))).map((r) => r.id));
    return rows.map((w) => ({ ...w, active: active.has(w.id) })).sort((a, b) => a.name.localeCompare(b.name));
  }

  private async context() {
    return {
      workflows: await this.workflows(),
      permissions: await grantablePermissionIds(this.db),
      roles: (await this.db.select({ key: roles.key }).from(roles)).map((r) => r.key),
      checkExpression,
    };
  }

  async current() {
    const app = (await loadBackOffice(this.db)) ?? await saveBackOfficeDraft(this.db, blankBackOffice(), this.user.email);
    const versions = await this.db.select({ version: clientAppVersions.version, publishedAt: clientAppVersions.publishedAt, publishedBy: clientAppVersions.publishedBy })
      .from(clientAppVersions).where(eq(clientAppVersions.appId, app.id)).orderBy(desc(clientAppVersions.version));
    const context = await this.context();
    return {
      id: app.id, name: app.name, draft: app.draft, activeVersion: app.activeVersion, versions, updatedAt: app.updatedAt, updatedBy: app.updatedBy,
      errors: validateBackOffice(app.draft, context),
      workflows: context.workflows,
      roles: (await this.db.select({ key: roles.key, name: roles.name }).from(roles).orderBy(asc(roles.name))),
      permissions: await tenantCatalog(this.db),
    };
  }

  async saveDraft(body: { definition?: unknown }) {
    const definition = body?.definition;
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new BadRequestError('definition must be an object');
    await saveBackOfficeDraft(this.db, definition as Record<string, unknown>, this.user.email);
    return this.current();
  }

  async validate(body?: { definition?: unknown }) {
    const app = await loadBackOffice(this.db);
    return { errors: validateBackOffice(body?.definition ?? app?.draft ?? blankBackOffice(), await this.context()) };
  }

  async publish() {
    const app = await loadBackOffice(this.db);
    if (!app) throw new NotFoundError('Nothing to publish yet');
    const errors = validateBackOffice(app.draft, await this.context());
    if (errors.length) throw new UnprocessableError('The back office cannot be published yet', errors);
    const definition = backOfficeDefinitionSchema.parse(app.draft);
    const version = await publishBackOffice(this.db, app.id, definition as unknown as Record<string, unknown>, this.user.email);
    await this.audit.record(this.tenant.id, this.actor, 'backoffice.published', { type: 'back_office', id: app.id, name: app.name }, {
      version, pages: Object.keys(definition.pages), actions: Object.keys(definition.actions), menu: definition.navigation.map((n) => n.label),
    });
    return this.current();
  }

  async activate(version: number) {
    const app = await loadBackOffice(this.db);
    if (!app) throw new NotFoundError('No back office yet');
    const [row] = await this.db.select({ version: clientAppVersions.version }).from(clientAppVersions).where(and(eq(clientAppVersions.appId, app.id), eq(clientAppVersions.version, version))).limit(1);
    if (!row) throw new NotFoundError(`Version ${version} does not exist`);
    await this.db.update(clientApps).set({ activeVersion: version }).where(eq(clientApps.id, app.id));
    await this.audit.record(this.tenant.id, this.actor, 'backoffice.activated', { type: 'back_office', id: app.id, name: app.name }, { version, previous: app.activeVersion });
    return this.current();
  }

  async version(version: number) {
    const app = await loadBackOffice(this.db);
    const [row] = app ? await this.db.select().from(clientAppVersions).where(and(eq(clientAppVersions.appId, app.id), eq(clientAppVersions.version, version))).limit(1) : [];
    if (!row) throw new NotFoundError(`Version ${version} does not exist`);
    return { version: row.version, definition: row.definition, publishedAt: row.publishedAt, publishedBy: row.publishedBy };
  }

  templates() {
    return BACK_OFFICE_TEMPLATES;
  }

  /**
   * Replace the draft with a template. The fee waivers template also creates its custom permission, the members'
   * authority-limit attribute (for those who may declare attributes) and its workflow, published as an access change
   * (it says who may start it: an administrator decides). Granting the permission to roles is left to administrators.
   */
  async installTemplate(body: { template?: string }) {
    const template = BACK_OFFICE_TEMPLATES.find((t) => t.id === body?.template);
    if (!template) throw new BadRequestError(`Unknown template "${body?.template ?? ''}"`);
    const notes: string[] = [...template.nextSteps];
    let workflow: { id: string; publication: string } | null = null;
    if (template.id === 'blank') {
      await saveBackOfficeDraft(this.db, blankBackOffice(), this.user.email);
    } else {
      if (!this.user.permissions.includes('workflows:manage')) throw new ForbiddenError('Installing this template creates a workflow (workflows:manage)');
      await ensureFeeWaiverPermission(this.db, this.user.email);
      if (this.user.permissions.includes('members:update')) await ensureAuthorityLimitAttribute(this.db);
      else notes.unshift('Ask an administrator to declare the member attribute "authorityLimit" (number) in Team → Member attributes.');
      const created = await ensureFeeWaiverWorkflow(this.db, this.user.email);
      const [active] = await this.db.select({ version: workflowVersions.version }).from(workflowVersions).where(and(eq(workflowVersions.workflowId, created.id), eq(workflowVersions.status, 'active'))).limit(1);
      let publication = 'already published';
      if (!active) {
        const outcome = await this.changes.submit(this.tenant, actorOf(this.user), 'workflow.publish', { workflowId: created.id, yaml: created.yaml });
        publication = outcome.status;
        if (outcome.status === 'pending_approval') notes.unshift('The "Fee waiver" workflow says who may start it: an administrator approves its publication in Access changes.');
      }
      workflow = { id: created.id, publication };
      await saveBackOfficeDraft(this.db, feeWaiversBackOffice(created.id) as unknown as Record<string, unknown>, this.user.email);
    }
    await this.audit.record(this.tenant.id, this.actor, 'backoffice.template_installed', { type: 'back_office' }, { template: template.id, workflow: workflow?.id ?? null });
    return { ...(await this.current()), installed: { template: template.id, workflow, nextSteps: notes } };
  }

  /** A synthetic member holding these roles (and attributes): what they would see. */
  private async subjectFor(roleKeys: string[], attributes: Record<string, unknown> = {}): Promise<RuleSubject> {
    const rows = roleKeys.length ? await this.db.select().from(roles) : [];
    const held = rows.filter((r) => roleKeys.includes(r.key));
    const permissions = resolvePermissions(held, TENANT_PERMISSION_IDS, undefined, await activeCustomKeys(this.db));
    return { userId: 'preview', email: 'preview@preview', kind: 'member', roles: held.map((r) => r.key), permissions, attributes };
  }

  private async draftDefinition(raw?: unknown): Promise<BackOfficeDefinition> {
    const app = await loadBackOffice(this.db);
    const parsed = backOfficeDefinitionSchema.safeParse(raw ?? app?.draft ?? blankBackOffice());
    if (!parsed.success) throw new BadRequestError('The draft is not a valid back office yet');
    return parsed.data;
  }

  /** The draft as a member with these roles would get it (structure only: no one's data). */
  async previewAs(body: { roles?: string[]; attributes?: Record<string, unknown>; definition?: unknown }) {
    const subject = await this.subjectFor(Array.isArray(body?.roles) ? body.roles.map(String) : [], body?.attributes ?? {});
    await this.audit.record(this.tenant.id, this.actor, 'backoffice.previewed', { type: 'back_office' }, { roles: subject.roles });
    return { roles: subject.roles, permissions: subject.permissions, definition: await pruneBackOffice(this.db, await this.draftDefinition(body?.definition), subject) };
  }

  /**
   * For every role: the menu items, pages, actions and additions to built-in pages its holders get from the draft, and
   * the widgets they would see empty (a source their permissions do not read). Conditions on attributes count as met.
   */
  async accessReport(body?: { definition?: unknown }) {
    const definition = await this.draftDefinition(body?.definition);
    const roleRows = await this.db.select({ key: roles.key, name: roles.name }).from(roles).orderBy(asc(roles.name));
    const report = [];
    for (const role of roleRows) {
      const subject = await this.subjectFor([role.key]);
      // Attribute conditions are about people, not roles: assume they hold for the report.
      const lenient = structuredClone(definition);
      const strip = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(strip);
        if (value && typeof value === 'object') {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(value)) out[k] = k === 'access' && v && typeof v === 'object' ? { ...(v as object), when: undefined } : strip(v);
          return out;
        }
        return value;
      };
      const pruned = await pruneBackOffice(this.db, strip(lenient) as BackOfficeDefinition, subject);
      const warnings: string[] = [];
      const lacking = (sources: string[]) => sources.filter((s) => {
        const need = SOURCE_PERMISSIONS[sourceFamily(s)] ?? [];
        return need.length > 0 && !need.some((all) => all.every((p) => subject.permissions.includes(p)));
      });
      for (const [key, page] of Object.entries(pruned.pages)) {
        const missing = lacking(backOfficePageSources(page));
        if (missing.length) warnings.push(`page "${page.title}" (${key}) shows nothing from ${missing.join(', ')}: the role cannot read it`);
      }
      const dashboardMissing = lacking(widgetsSources(pruned.slots.dashboard));
      if (dashboardMissing.length && pruned.slots.dashboard.length) warnings.push(`dashboard widgets show nothing from ${dashboardMissing.join(', ')}`);
      for (const [key, action] of Object.entries(definition.actions)) {
        // The action's own rule lets the role in, but it is gone: the workflow's start rule excludes the role. Worth saying
        // (without a rule of its own, the workflow's is the only gate: nothing surprising).
        if (!pruned.actions[key] && action.access && satisfiesAccessRule(action.access, subject)) warnings.push(`action "${action.label}" is hidden: the workflow's start rule excludes this role`);
      }
      report.push({
        role: role.key, name: role.name,
        menu: pruned.navigation.map((n) => n.label),
        pages: Object.values(pruned.pages).map((p) => p.title),
        actions: Object.values(pruned.actions).map((a) => a.label),
        clientPage: { buttons: pruned.slots.client.actions.map((a) => pruned.actions[a.action]?.label ?? a.action), tabs: pruned.slots.client.tabs.map((t) => t.label) },
        casePage: { buttons: pruned.slots.case.actions.map((a) => pruned.actions[a.action]?.label ?? a.action), tabs: pruned.slots.case.tabs.map((t) => t.label) },
        dashboardWidgets: pruned.slots.dashboard.length,
        warnings,
      });
    }
    // Permissions the draft requires that no role but the administrator holds: those items reach nobody else yet.
    const required = new Set<string>();
    JSON.stringify(definition, (k, v) => { if (k === 'permissions' && Array.isArray(v)) v.forEach((p: string) => required.add(p)); return v; });
    const held = new Set<string>();
    for (const role of roleRows) {
      if (role.key === 'admin') continue;
      for (const permission of (await this.subjectFor([role.key])).permissions) held.add(permission);
    }
    const nobody = [...required].filter((p) => !held.has(p)).sort();
    return { roles: report, heldByNobody: nobody };
  }
}
