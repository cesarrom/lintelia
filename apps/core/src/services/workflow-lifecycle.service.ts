import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import YAML from 'yaml';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { connectorInstallations, roles, sysWorkflows, workflowVersions } from '../entities';
import { parseConnectorComponentType } from '@repo/fintivio/schemas';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { CASE_REPOSITORY } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { parseDefinition } from '../engine/definition';
import { validateDefinition } from '../engine/components/validation';
import { templateYaml, WORKFLOW_TEMPLATES } from '../engine/templates';
import { WorkflowsService } from './workflows.service';
import { AuditWriter } from './audit.writer';
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
    } catch (error) {
      errors = [`Invalid YAML: ${(error as Error).message}`];
    }
    return { workflow, errors };
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

  async publish(workflowId: string) {
    const { workflow, errors } = await this.validate(workflowId);
    if (errors.length) throw new UnprocessableError('The workflow cannot be published', errors);
    const version = await this.nextVersion(workflowId);
    const startOn = parseDefinition(workflow.yaml).startOn;
    await this.db.transaction(async (tx) => {
      await tx.update(workflowVersions).set({ status: 'retired' }).where(and(eq(workflowVersions.workflowId, workflowId), eq(workflowVersions.status, 'active')));
      await tx.insert(workflowVersions).values({ workflowId, version, yaml: workflow.yaml, startOn, publishedBy: this.user.email });
      await tx.update(sysWorkflows).set({ status: 'active', version }).where(eq(sysWorkflows.id, workflowId));
    });
    await this.audit.record(this.tenant.id, this.actor, 'workflow.published', { type: 'workflow', id: workflowId, name: workflow.name }, { version, startOn });
    return { id: workflowId, version, status: 'active' as const, startOn };
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
    return rows
      .filter(({ version }) => !version.startOn.length)
      .map(({ version, name }) => ({ id: version.workflowId, name, version: version.version, inputs: parseDefinition(version.yaml).inputs }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  definitionOf(yaml: string) {
    return YAML.parse(yaml);
  }
}
