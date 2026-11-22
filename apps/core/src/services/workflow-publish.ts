import { and, desc, eq } from 'drizzle-orm';
import YAML from 'yaml';
import { normalizeWorkflowAccess } from '@repo/lintelia/schemas';
import { sysWorkflows, workflowVersions } from '../entities';
import type { TenantDatabase } from '../clients/database.client';
import { parseDefinition } from '../engine/definition';
import { NotFoundError } from '../http/errors';
import type { AuditActor, AuditWriter } from './audit.writer';

/**
 * Freeze a definition as the next immutable version of a workflow (its `startOn` and `access` indexed on the row).
 * Used by publishing and by approved access changes (docs/plans/15 §5.3), which publish the YAML that was approved.
 */
export async function publishWorkflowVersion(db: TenantDatabase, audit: AuditWriter, tenantId: string, actor: AuditActor, workflowId: string, yaml: string, details: Record<string, unknown> = {}) {
  const [workflow] = await db.select().from(sysWorkflows).where(eq(sysWorkflows.id, workflowId));
  if (!workflow) throw new NotFoundError('Workflow not found');
  const [latest] = await db.select({ version: workflowVersions.version }).from(workflowVersions).where(eq(workflowVersions.workflowId, workflowId)).orderBy(desc(workflowVersions.version)).limit(1);
  const version = (latest?.version ?? 0) + 1;
  const definition = parseDefinition(yaml);
  const startOn = definition.startOn;
  const access = normalizeWorkflowAccess(YAML.parse(yaml)?.access);
  await db.transaction(async (tx) => {
    await tx.update(workflowVersions).set({ status: 'retired' }).where(and(eq(workflowVersions.workflowId, workflowId), eq(workflowVersions.status, 'active')));
    await tx.insert(workflowVersions).values({ workflowId, version, yaml, startOn, access, publishedBy: actor.email ?? 'system' });
    await tx.update(sysWorkflows).set({ status: 'active', version }).where(eq(sysWorkflows.id, workflowId));
  });
  await audit.record(tenantId, actor, 'workflow.published', { type: 'workflow', id: workflowId, name: workflow.name }, { version, startOn, ...(access ? { access } : {}), ...details });
  return { id: workflowId, version, status: 'active' as const, startOn, access };
}

