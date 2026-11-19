import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import YAML from 'yaml';
import { normalizeWorkflowAccess, sameAccess, type Tenant, type User } from '@repo/fintivio/schemas';
import { AccessChanges, actorOf } from '../access/changes';
import { allows, DEFAULT_START_RULE, governingWorkflowAccess, subjectOf, workflowAccessErrors, workflowAccessOf } from '../access/rules';
import { publishWorkflowVersion } from './workflow-publish';

export { publishWorkflowVersion };
import type { TenantDatabase } from '../clients/database.client';
import { connectorInstallations, roles, sysWorkflows, workflowVersions } from '../entities';
import { parseConnectorComponentType } from '@repo/fintivio/schemas';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { CASE_REPOSITORY } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { functionWorkflowId } from '../engine/components';
import { functionComponent } from '../engine/components/parties';
import { parseDefinition } from '../engine/definition';
import { validateDefinition } from '../engine/components/validation';
import { templateYaml, WORKFLOW_TEMPLATES } from '../engine/templates';
import { WorkflowsService } from './workflows.service';
import { AuditWriter, type AuditActor } from './audit.writer';
import { NotFoundError, UnprocessableError } from '../http/errors';

/**
 * Workflow lifecycle: drafts (sys_workflows.yaml) are edited freely; publishing validates the draft and freezes it as
 * the next immutable version (workflow_versions), which new cases use. Running cases keep their version.
 */
@Injectable({ scope: Scope.REQUEST })
export class WorkflowLifecycleService {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(WorkflowsService) private readonly workflows: WorkflowsService,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(AccessChanges) private readonly changes: AccessChanges,
  ) { }

  private get db() {
    return this.repository.db(this.tenant.id);
  }

  private get actor() {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  templates() {
    return WORKFLOW_TEMPLATES;
  }

  async createFromTemplate(templateId: string) {
    const yaml = templateYaml(templateId);
    if (!yaml) throw new NotFoundError('Unknown template');
    const saved = await this.workflows.saveWorkflow({ yaml, createdBy: this.user.email });
    await this.audit.record(this.tenant.id, this.actor, 'workflow.created', { type: 'workflow', id: saved.id, name: saved.name }, { template: templateId });
    return { id: saved.id, name: saved.name, status: saved.status, version: await this.nextVersion(saved.id!) };
  }

  /** The version number the current draft will get when published. */
  draftVersion(workflowId: string) {
    return this.nextVersion(workflowId);
  }

  private async nextVersion(workflowId: string) {
    return (await this.repository.latestVersionNumber(this.tenant.id, workflowId)) + 1;
  }

  /** Validation errors of the current draft (empty when publishable). */
  async validate(workflowId: string) {
    const [workflow] = await this.db.select().from(sysWorkflows).where(eq(sysWorkflows.id, workflowId));
    if (!workflow) throw new NotFoundError('Workflow not found');
    const roleKeys = (await this.db.select({ key: roles.key }).from(roles)).map((r) => r.key);
    let errors: string[];
    try {
      const definition = parseDefinition(workflow.yaml);
      errors = validateDefinition(definition, { roles: roleKeys });
      errors.push(...(await this.connectionErrors(definition.steps)));
      errors.push(...(await this.functionErrors(definition.steps, workflowId)));
      errors.push(...(await workflowAccessErrors(this.db, workflowAccessOf(workflow.yaml))));
    } catch (error) {
      errors = [`Invalid YAML: ${(error as Error).message}`];
    }
    return { workflow, errors };
  }

  /** The institution's functions as components of the editor's palette (`function:<workflow id>`). */
  async functionDefinitions() {
    const rows = await this.db.select({ version: workflowVersions, name: sysWorkflows.name }).from(workflowVersions)
      .innerJoin(sysWorkflows, eq(sysWorkflows.id, workflowVersions.workflowId))
      .where(eq(workflowVersions.status, 'active'));
    return rows.flatMap(({ version, name }) => {
      const definition = parseDefinition(version.yaml);
      if (!definition.function) return [];
      const outputs = Object.keys(definition.outputs);
      return [{
        ...functionComponent(version.workflowId, { name, description: definition.description, inputs: definition.inputs }).definition,
        outputSchema: { type: 'object' as const, properties: Object.fromEntries(outputs.map((key) => [key, { title: key }])) },
      }];
    });
  }

  /** Function steps must call a published workflow marked `function: true` (not this one: no recursion). */
  private async functionErrors(steps: Array<{ name: string; type: string }>, workflowId: string) {
    const errors: string[] = [];
    for (const step of steps) {
      const target = functionWorkflowId(step.type);
      if (!target) continue;
      if (target === workflowId) { errors.push(`${step.name}: a function cannot call itself`); continue; }
      const [active] = await this.db.select().from(workflowVersions).where(and(eq(workflowVersions.workflowId, target), eq(workflowVersions.status, 'active'))).limit(1);
      if (!active) errors.push(`${step.name}: the function is not published`);
      else if (!parseDefinition(active.yaml).function) errors.push(`${step.name}: "${parseDefinition(active.yaml).name}" is not a function (function: true)`);
    }
    return errors;
  }

  /** Connector steps must use an active connection of their connector (docs/plans/03). */
  private async connectionErrors(steps: Array<{ id: string; name: string; type: string; config: Record<string, any> }>) {
    const connectorSteps = steps.map((step) => ({ step, parsed: parseConnectorComponentType(step.type) })).filter((s) => s.parsed);
    if (!connectorSteps.length) return [];
    const installations = await this.db.select().from(connectorInstallations);
    const errors: string[] = [];
    for (const { step, parsed } of connectorSteps) {
      const connection = installations.find((i) => i.id === step.config?.connection);
      if (!connection || connection.connectorId !== parsed!.connectorId || connection.status === 'disabled') {
        errors.push(`${step.name}: choose a connection to ${parsed!.connectorId}`);
      } else if (connection.status === 'pending') {
        errors.push(`${step.name}: the connection "${connection.displayName}" is not set up yet`);
      }
    }
    return errors;
  }

  /** Stop new cases on a workflow (running cases continue on their version). */
  async retire(workflowId: string) {
    const [workflow] = await this.db.select().from(sysWorkflows).where(eq(sysWorkflows.id, workflowId));
    if (!workflow) throw new NotFoundError('Workflow not found');
    const retired = await this.db.update(workflowVersions).set({ status: 'retired' })
      .where(and(eq(workflowVersions.workflowId, workflowId), eq(workflowVersions.status, 'active'))).returning();
    await this.db.update(sysWorkflows).set({ status: 'draft' }).where(eq(sysWorkflows.id, workflowId));
    if (retired.length) {
      await this.audit.record(this.tenant.id, this.actor, 'workflow.retired', { type: 'workflow', id: workflowId, name: workflow.name }, { version: retired[0].version });
    }
    return { id: workflowId, status: 'draft' as const, retiredVersion: retired[0]?.version ?? null };
  }

  /**
   * Publish the draft. When it changes who may start the workflow or see its cases (`access`), it is an access change
   * (docs/plans/15 §5.3, §14): an administrator (`roles:manage`) decides — at once when the publisher is one and the
   * policy asks for no second approver, otherwise it waits.
   */
  async publish(workflowId: string, options: { effectiveAt?: string } = {}) {
    const { workflow, errors } = await this.validate(workflowId);
    if (errors.length) throw new UnprocessableError('The workflow cannot be published', errors);
    const before = (await governingWorkflowAccess(this.db)).get(workflowId) ?? null;
    if (sameAccess(before, workflowAccessOf(workflow.yaml)) && !options.effectiveAt) {
      const result = await publishWorkflowVersion(this.db, this.audit, this.tenant.id, this.actor, workflowId, workflow.yaml);
      return { status: 'applied' as const, change: null, result };
    }
    return this.changes.submit<Awaited<ReturnType<typeof publishWorkflowVersion>>>(this.tenant, actorOf(this.user), 'workflow.publish', { workflowId, yaml: workflow.yaml }, { effectiveAt: options.effectiveAt });
  }

  /** Published versions, newest last, plus the draft when it differs from the active version. */
  async versions(workflowId: string) {
    const [workflow] = await this.db.select().from(sysWorkflows).where(eq(sysWorkflows.id, workflowId));
    if (!workflow) throw new NotFoundError('Workflow not found');
    const rows = await this.db.select().from(workflowVersions).where(eq(workflowVersions.workflowId, workflowId)).orderBy(workflowVersions.version);
    const list: Array<{ version: number; status: string; publishedAt?: Date; publishedBy?: string }> =
      rows.map((r) => ({ version: r.version, status: r.status, publishedAt: r.publishedAt, publishedBy: r.publishedBy }));
    const latest = rows.at(-1);
    if (!latest || latest.yaml !== workflow.yaml) list.push({ version: (latest?.version ?? 0) + 1, status: 'draft' });
    return list;
  }

  /** Summary used by lists: draft/published state and the active version. */
  async describe(workflowId: string) {
    const [active] = await this.db.select().from(workflowVersions).where(and(eq(workflowVersions.workflowId, workflowId), eq(workflowVersions.status, 'active'))).orderBy(desc(workflowVersions.version)).limit(1);
    return { activeVersion: active?.version ?? null, startOn: active?.startOn ?? [] };
  }

  async startable() {
    const rows = await this.db.select({ version: workflowVersions, name: sysWorkflows.name }).from(workflowVersions)
      .innerJoin(sysWorkflows, eq(sysWorkflows.id, workflowVersions.workflowId))
      .where(eq(workflowVersions.status, 'active'));
    // Only what this member may start (the workflow's start rule, or cases:create when it has none).
    const subject = subjectOf(this.user);
    const allowed = new Set<string>();
    for (const { version } of rows) {
      if (await allows(normalizeWorkflowAccess(version.access)?.start ?? DEFAULT_START_RULE, subject)) allowed.add(version.workflowId);
    }
    return rows
      .filter(({ version }) => !version.startOn.length && allowed.has(version.workflowId))
      .map(({ version, name }) => ({ id: version.workflowId, name, version: version.version, inputs: parseDefinition(version.yaml).inputs }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  definitionOf(yaml: string) {
    return YAML.parse(yaml);
  }
}
