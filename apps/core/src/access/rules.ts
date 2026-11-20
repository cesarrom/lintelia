import jsonata from 'jsonata';
import YAML from 'yaml';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import {
  accessRuleErrors, normalizeWorkflowAccess, satisfiesAccessRule, type AccessRule, type User, type WorkflowAccess,
} from '@repo/lintelia/schemas';
import { roles, workflowVersions } from '../entities';
import { grantablePermissionIds } from './catalog';
import type { TenantDatabase } from '../clients/database.client';

/**
 * Access rules on things (docs/plans/15 §5.2): the permission and role parts come from the shared package; the
 * condition (`when`) is JSONata over the member (id, e-mail, roles, attributes) and the context. A condition can only
 * narrow: one that fails to evaluate denies.
 */
export interface RuleSubject {
  userId: string;
  email: string;
  kind: string;
  roles: readonly string[];
  permissions: readonly string[];
  attributes: Record<string, unknown>;
}

export const subjectOf = (user: User): RuleSubject => ({
  userId: user.userId, email: user.email, kind: user.kind,
  roles: user.userTenants[0]?.roleNames ?? [], permissions: user.permissions, attributes: user.attributes ?? {},
});

const compiled = new Map<string, ReturnType<typeof jsonata>>();
function expression(source: string) {
  let compiledExpression = compiled.get(source);
  if (!compiledExpression) {
    compiledExpression = jsonata(source.replace(/^\s*=/, ''));
    if (compiled.size > 500) compiled.delete(compiled.keys().next().value!);
    compiled.set(source, compiledExpression);
  }
  return compiledExpression;
}

/** A JSONata syntax error of a condition, or null. */
export function conditionError(source: string | undefined) {
  if (!source) return null;
  try {
    jsonata(source.replace(/^\s*=/, ''));
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

export async function evaluateCondition(source: string | undefined, subject: RuleSubject, context: Record<string, unknown> = {}) {
  if (!source) return true;
  try {
    const member = { id: subject.userId, email: subject.email, roles: subject.roles, attributes: subject.attributes, permissions: subject.permissions };
    return Boolean(await expression(source).evaluate({ ...context, member }));
  } catch {
    return false;
  }
}

export async function allows(rule: AccessRule | null | undefined, subject: RuleSubject, context: Record<string, unknown> = {}) {
  if (!rule) return true;
  if (!satisfiesAccessRule(rule, subject)) return false;
  return evaluateCondition(rule.when, subject, context);
}

/**
 * The access rules that govern each workflow: those of its latest published version (active or retired), so tightening
 * who sees a workflow's cases also covers the cases started on earlier versions.
 */
export async function governingWorkflowAccess(db: TenantDatabase): Promise<Map<string, WorkflowAccess>> {
  const rows = await db.select({ workflowId: workflowVersions.workflowId, access: workflowVersions.access, version: workflowVersions.version })
    .from(workflowVersions).orderBy(desc(workflowVersions.version));
  const result = new Map<string, WorkflowAccess>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.workflowId)) continue;
    seen.add(row.workflowId);
    const access = normalizeWorkflowAccess(row.access);
    if (access) result.set(row.workflowId, access);
  }
  return result;
}

/** Workflows whose cases this member may not see (their `access.cases` rule excludes them). */
export async function hiddenWorkflowIds(db: TenantDatabase, subject: RuleSubject): Promise<string[]> {
  const governing = await governingWorkflowAccess(db);
  const hidden: string[] = [];
  for (const [workflowId, access] of governing) {
    if (access.cases && !(await allows(access.cases, subject))) hidden.push(workflowId);
  }
  return hidden;
}

/** The active version's start rule; without one, starting by hand needs `cases:create` (the behaviour before rules). */
export async function startRuleOf(db: TenantDatabase, workflowId: string): Promise<AccessRule> {
  const [row] = await db.select({ access: workflowVersions.access }).from(workflowVersions)
    .where(and(eq(workflowVersions.workflowId, workflowId), eq(workflowVersions.status, 'active'), isNotNull(workflowVersions.access))).limit(1);
  return normalizeWorkflowAccess(row?.access)?.start ?? DEFAULT_START_RULE;
}

export const DEFAULT_START_RULE: AccessRule = { permissions: ['cases:create'] };

// --- workflow access in definitions (publication) -------------------------------------------------------------------

export const workflowAccessOf = (yaml: string): WorkflowAccess | null => {
  try {
    return normalizeWorkflowAccess(YAML.parse(yaml)?.access);
  } catch {
    return null;
  }
};

export async function workflowAccessErrors(db: TenantDatabase, access: WorkflowAccess | null) {
  if (!access) return [];
  const known = { permissions: await grantablePermissionIds(db), roles: (await db.select({ key: roles.key }).from(roles)).map((r) => r.key) };
  const errors = [
    ...accessRuleErrors(access.start, known, 'Who may start it'),
    ...accessRuleErrors(access.cases, known, 'Who may see its cases'),
  ];
  for (const [where, rule] of [['Who may start it', access.start], ['Who may see its cases', access.cases]] as const) {
    const error = conditionError(rule?.when);
    if (error) errors.push(`${where}: the condition is not valid JSONata (${error})`);
  }
  return errors;
}

