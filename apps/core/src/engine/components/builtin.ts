import { PARTY_COMPONENTS } from './parties';
import { CLIENT_APP_COMPONENTS } from './client-app';
import { INTEGRATION_COMPONENTS } from './integration';
import { EVENT_COMPONENTS } from './events';
import * as restate from '@restatedev/restate-sdk/fetch';
import type { CaseStatus, TaskOutcome } from '../../entities';
import { DEFAULT_REVIEW_OUTCOMES, type CaseRow } from '../case-repository';
import { durationMs } from '../durations';
import { evaluate } from '../expressions';
import { setCaseKeys } from '../events';
import { WORKFLOW_ACTOR, type EngineComponent, type StepContext, type TaskSignal } from './types';

/** Legacy comparison operators of the editor's conditional node. */
function compare(operator: string, left: unknown, right: unknown): boolean {
  const l = left as any;
  switch (operator) {
    case 'equals': return l == right; // eslint-disable-line eqeqeq
    case 'notEquals': return l != right; // eslint-disable-line eqeqeq
    case 'greaterThan': return Number(l) > Number(right);
    case 'greaterThanOrEqual': return Number(l) >= Number(right);
    case 'lessThan': return Number(l) < Number(right);
    case 'lessThanOrEqual': return Number(l) <= Number(right);
    case 'contains': return String(l ?? '').includes(String(right));
    case 'notContains': return !String(l ?? '').includes(String(right));
    case 'startsWith': return String(l ?? '').startsWith(String(right));
    case 'endsWith': return String(l ?? '').endsWith(String(right));
    case 'matches': return new RegExp(String(right)).test(String(l ?? ''));
    case 'isNull': return l === null || l === undefined;
    case 'isNotNull': return l !== null && l !== undefined;
    case 'isEmpty': return l === null || l === undefined || l === '' || (Array.isArray(l) && l.length === 0);
    case 'isNotEmpty': return !(l === null || l === undefined || l === '' || (Array.isArray(l) && l.length === 0));
    case 'isTrue': return l === true || l === 'true';
    case 'isFalse': return l === false || l === 'false';
    default: throw new restate.TerminalError(`Unknown operator ${operator}`);
  }
}

export function humanStatus(status: string) {
  return ({ approved: 'approved', rejected: 'not approved', closed: 'closed', completed: 'completed', expired: 'expired', withdrawn: 'withdrawn' } as Record<string, string>)[status] ?? status.replace(/_/g, ' ');
}

function defaultDecisionMessage(status: string, title: string) {
  switch (status) {
    case 'approved': return `Good news: your application "${title}" has been approved.`;
    case 'rejected': return `We are sorry: we could not approve your application "${title}".`;
    case 'expired': return `Your application "${title}" has expired because we did not receive the information we needed.`;
    default: return `Your application "${title}" is now ${humanStatus(status)}.`;
  }
}

const role = (title: string, description?: string) => ({ type: 'string', title, description, 'x-widget': 'role', 'x-expression': true } as const);
const duration = (title: string, description?: string) => ({ type: 'string', title, description, 'x-widget': 'duration' } as const);
const text = (title: string, description?: string, widget?: string) => ({ type: 'string', title, description, 'x-expression': true, ...(widget ? { 'x-widget': widget } : {}) } as const);
const RISK = { type: 'string', title: 'Risk level', enum: ['low', 'medium', 'high'], 'x-enum-labels': ['Low', 'Medium', 'High'] } as const;
const FLAGS = { type: 'array', title: 'Add flags', items: { type: 'string' }, description: 'Tags added to the case, e.g. under_investigation' } as const;

// --- flow --------------------------------------------------------------------------------------------------------------

const start: EngineComponent = {
  definition: {
    type: 'start', version: 1, title: 'Start', description: 'Entry point; receives the inputs (form answers, event payload).',
    icon: 'Play', category: 'flow', kind: 'automatic', source: { kind: 'builtin' }, hidden: true,
    configSchema: { type: 'object', properties: {} }, events: { static: ['finished'] },
  },
  async execute({ step, vars }) {
    return { event: step.events[0]?.name ?? 'finished', output: vars.input };
  },
};

const end: EngineComponent = {
  definition: {
    type: 'end', version: 1, title: 'End', description: 'Ends this branch of the workflow.', icon: 'CircleStop',
    category: 'flow', kind: 'automatic', source: { kind: 'builtin' }, configSchema: { type: 'object', properties: {} }, events: {},
  },
  async execute() {
    return { event: null, output: null };
  },
};

const conditional: EngineComponent = {
  definition: {
    type: 'conditional', version: 1, title: 'Condition', description: 'Branches on a JSONata expression (true / false).',
    icon: 'GitBranch', category: 'flow', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string', title: 'Condition', description: 'JSONata, e.g. $number(input.amount) <= 10000', 'x-widget': 'expression' },
      },
    },
    defaults: { expression: 'true' },
    summary: 'If {{expression}}',
    events: { static: ['true', 'false'] },
  },
  validate: (config) => (config.expression || config.operator ? [] : ['needs an expression']),
  async execute({ ctx, step, label, config, vars }) {
    const outcome = await ctx.run(`evaluate-${label}`, async () => {
      if (step.config.expression) return Boolean(await evaluate(String(step.config.expression), vars));
      return compare(config.operator, config.leftValue, config.rightValue);
    });
    return { event: outcome ? 'true' : 'false', output: { result: outcome } };
  },
};

const calculate: EngineComponent = {
  definition: {
    type: 'calculate', version: 1, title: 'Calculate', description: 'Computes named values with JSONata expressions (affordability, scores, mappings).',
    icon: 'Calculator', category: 'data', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: {
      type: 'object',
      required: ['outputs'],
      properties: {
        outputs: { type: 'object', title: 'Outputs', description: 'name → JSONata expression; available later as steps.<step id>.<name>', additionalProperties: { type: 'string' }, 'x-widget': 'keyValue' },
      },
    },
    defaults: { outputs: { value: '1 + 1' } },
    summary: 'Computes {{outputs}}',
    events: { static: ['done'] },
  },
  resolveConfig: false,
  validate: (config) => (config.outputs && typeof config.outputs === 'object' ? [] : ['needs outputs']),
  async execute({ ctx, step, label, vars }) {
    const output = await ctx.run(`calculate-${label}`, async () => {
      const values: Record<string, unknown> = {};
      const scope = { ...vars, result: values };
      for (const [key, expression] of Object.entries(step.config.outputs ?? {})) {
        values[key] = typeof expression === 'string' ? await evaluate(expression, scope) : expression;
      }
      return values;
    });
    return { event: 'done', output };
  },
};

const dataMap: EngineComponent = {
  ...calculate,
  definition: { ...calculate.definition, type: 'data.map', title: 'Map data', description: 'Transforms data into named values (JSONata), e.g. the list of parties from a form.', icon: 'Shuffle' },
};

const wait: EngineComponent = {
  definition: {
    type: 'wait', version: 1, title: 'Wait', description: 'Pauses the case for a duration (durable timer).',
    icon: 'Timer', category: 'flow', kind: 'timer', source: { kind: 'builtin' },
    configSchema: { type: 'object', required: ['duration'], properties: { duration: duration('Duration', 'ISO-8601, e.g. PT1H, P2D') } },
    defaults: { duration: 'PT1H' },
    summary: 'Wait {{duration}}',
    events: { static: ['done'] },
  },
  validate: (config) => (durationMs(config.duration) ? [] : ['needs a valid ISO-8601 duration']),
  async execute({ ctx, label, config }) {
    await ctx.sleep(durationMs(config.duration) ?? 0, `wait-${label}`);
    return { event: 'done', output: {} };
  },
};

// --- communication -----------------------------------------------------------------------------------------------------

const email: EngineComponent = {
  definition: {
    type: 'email', version: 1, title: 'E-mail', description: "Sends a branded e-mail from the institution (platform mailer).",
    icon: 'Mail', category: 'communication', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['to', 'subject'],
      properties: {
        to: text('To', 'address or {{case.applicant.email}}'),
        subject: text('Subject'),
        body: text('Message', 'paragraphs separated by a blank line; {{templates}} allowed', 'textarea'),
      },
    },
    defaults: { to: '{{case.applicant.email}}', subject: 'About your application {{case.reference}}', body: '' },
    summary: 'To {{to}}: {{subject}}',
    events: { static: ['success', 'failed'] },
  },
  validate: (config) => (config.to && config.subject ? [] : ['needs to and subject']),
  async execute({ ctx, label, config, tenantId, deps }) {
    const ok = await ctx.run(`email-${label}`, async () => {
      try {
        const tenant = await deps.loadTenant(tenantId);
        await deps.notifier.send(tenant, String(config.to), String(config.subject), String(config.template ?? config.body ?? '').split(/\n{2,}/));
        return true;
      } catch (error) {
        console.error('email step failed', error);
        return false;
      }
    });
    return { event: ok ? 'success' : 'failed', output: { sent: ok } };
  },
};

// --- case --------------------------------------------------------------------------------------------------------------

const caseUpdate: EngineComponent = {
  definition: {
    type: 'case.update', version: 1, title: 'Update case', description: 'Moves the case to a stage, saves values on it, sets the risk level, adds flags or changes the title.',
    icon: 'FilePen', category: 'case', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', properties: {
        stage: text('Stage', 'a key of the workflow\'s stages, e.g. underwriting'),
        data: { type: 'object', title: 'Save on the case', description: 'field → value (expressions allowed), merged into the case data', additionalProperties: { type: 'string', 'x-expression': true }, 'x-widget': 'keyValue' },
        riskLevel: RISK, addFlags: FLAGS, title: text('New title'),
        keys: { type: 'object', title: 'Business keys', description: 'name → value (e.g. loan → = steps.board.loanId): events about this value reach the case (docs/plans/17)', additionalProperties: { type: 'string', 'x-expression': true }, 'x-widget': 'keyValue' },
      },
    },
    summary: 'Stage {{stage}} · Risk {{riskLevel}} · flags {{addFlags}}',
    events: { static: ['done'] },
  },
  async execute({ ctx, label, config, tenantId, caseId, deps }) {
    const updated = await ctx.run(`update-${label}`, async () => {
      const current = (await deps.repository.getCase(tenantId, caseId))!;
      const changes: Partial<CaseRow> = {};
      if (config.riskLevel) changes.riskLevel = String(config.riskLevel);
      if (config.title) changes.title = String(config.title);
      if (Array.isArray(config.addFlags)) changes.flags = [...new Set([...current.flags, ...config.addFlags.map(String)])];
      if (config.data && typeof config.data === 'object') changes.data = { ...current.data, ...(config.data as Record<string, unknown>) };
      const stage = config.stage ? String(config.stage) : null;
      if (stage && stage !== current.stage) changes.stage = stage;
      await deps.repository.updateCase(tenantId, caseId, changes);
      const { data: _data, ...logged } = changes;
      await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'case.updated', { type: 'case', id: caseId }, { ...logged, ...(changes.data ? { dataFields: Object.keys(config.data) } : {}) } as Record<string, unknown>, caseId);
      if (changes.stage) await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'case.stage_changed', { type: 'case', id: caseId, reference: current.reference }, { from: current.stage, to: changes.stage }, caseId);
      if (config.keys && typeof config.keys === 'object') await setCaseKeys(deps.repository.db(tenantId), caseId, config.keys as Record<string, unknown>);
      return { ...logged, stage: changes.stage ?? current.stage, ...(changes.data ? { data: config.data } : {}), ...(config.keys ? { keys: config.keys } : {}) };
    });
    return { event: 'done', output: updated };
  },
};

const CASE_STATUSES = ['approved', 'rejected', 'closed', 'completed', 'withdrawn', 'expired'];

const caseDecision: EngineComponent = {
  definition: {
    type: 'case.decision', version: 1, title: 'Decision', description: 'Closes the case with a final status and business outcome; tells the applicant unless disabled.',
    icon: 'Gavel', category: 'case', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['status'],
      properties: {
        status: { type: 'string', title: 'Final status', enum: CASE_STATUSES, 'x-enum-labels': ['Approved', 'Rejected', 'Closed', 'Completed', 'Withdrawn', 'Expired'] },
        outcome: { type: 'string', title: 'Outcome', description: 'business result, e.g. pre_approved, sar_filed' },
        riskLevel: RISK,
        addFlags: FLAGS,
        notifyApplicant: { type: 'boolean', title: 'E-mail the applicant', default: true },
        message: text('Message to the applicant', 'default message when empty', 'textarea'),
      },
    },
    defaults: { status: 'approved', notifyApplicant: true },
    summary: '{{status}} · {{outcome}}',
    events: { static: ['done'] },
  },
  validate: (config) => (CASE_STATUSES.includes(String(config.status)) ? [] : ['needs a final status']),
  async execute({ ctx, label, config, tenantId, caseId, deps }) {
    const status = String(config.status) as CaseStatus;
    await ctx.run(`decision-${label}`, async () => {
      const changes: Partial<CaseRow> = { status, outcome: config.outcome ? String(config.outcome) : status, completedAt: new Date() };
      if (config.riskLevel) changes.riskLevel = String(config.riskLevel);
      const current = (await deps.repository.getCase(tenantId, caseId))!;
      if (Array.isArray(config.addFlags)) changes.flags = [...new Set([...current.flags, ...config.addFlags.map(String)])];
      await deps.repository.updateCase(tenantId, caseId, changes);
      await deps.audit.record(tenantId, WORKFLOW_ACTOR, `case.${status}`, { type: 'case', id: caseId }, { outcome: changes.outcome }, caseId);
      if (config.notifyApplicant !== false && current.clientVisibility === 'full' && current.applicantEmail && !current.parentCaseId) {
        const tenant = await deps.loadTenant(tenantId);
        const message = config.message ? String(config.message) : defaultDecisionMessage(status, current.title);
        await deps.notifier.send(tenant, current.applicantEmail, `Your application ${current.reference}: ${humanStatus(status)}`, [message], { label: 'View your application', url: deps.notifier.portalUrl(tenant, caseId) });
      }
    });
    return { event: 'done', output: { status, outcome: config.outcome ?? status } };
  },
};

// --- people ------------------------------------------------------------------------------------------------------------

const OUTCOME_ITEM = {
  type: 'object',
  properties: {
    key: { type: 'string', title: 'Key', description: 'event name, e.g. escalate' },
    label: { type: 'string', title: 'Button label' },
    requiresReason: { type: 'boolean', title: 'Reason required' },
    needsSecondApproval: { type: 'boolean', title: 'Second approver (high authority)' },
  },
} as const;

const review: EngineComponent = {
  definition: {
    type: 'review', version: 1, title: 'Human review', description: 'A decision task routed to a role, with authority, SLA and escalation. Outcomes become events.',
    icon: 'ClipboardCheck', category: 'people', kind: 'human', source: { kind: 'builtin' },
    configSchema: {
      type: 'object',
      required: ['assignTo'],
      properties: {
        title: text('Task title'),
        description: text('Instructions', undefined, 'textarea'),
        assignTo: { type: 'object', title: 'Route to', properties: { role: role('Role queue') }, required: ['role'] },
        authority: { type: 'string', title: 'Authority', enum: ['standard', 'high'], 'x-enum-labels': ['Standard', 'High (needs cases:approve_high_risk; four-eyes on approvals)'], 'x-expression': true },
        sla: duration('SLA', 'escalates when exceeded, e.g. PT24H'),
        escalateTo: { type: 'object', title: 'Escalate to', properties: { role: role('Role queue') } },
        outcomes: { type: 'array', title: 'Outcomes', description: 'empty = Approve / Reject / Request information', items: OUTCOME_ITEM },
        requireCommentOnReject: { type: 'boolean', title: 'Reason required to reject (default outcomes)', default: true },
      },
    },
    defaults: { title: 'Review', assignTo: { role: 'reviewer' }, authority: 'standard', sla: 'PT24H', escalateTo: { role: 'senior_reviewer' } },
    summary: 'Queue {{assignTo.role}} · SLA {{sla}}',
    events: { fromConfig: 'outcomes', defaults: ['review_approved', 'review_rejected'], aliases: { approve: 'review_approved', reject: 'review_rejected', request_info: null } },
  },
  validate: (config, context) => {
    const errors: string[] = [];
    const queue = config.assignTo?.role;
    if (!queue) errors.push('needs assignTo.role');
    for (const r of [queue, config.escalateTo?.role].filter((x) => x && !String(x).trim().startsWith('='))) {
      if (context.roles && !context.roles.includes(r)) errors.push(`routes to unknown role "${r}"`);
    }
    for (const outcome of Array.isArray(config.outcomes) ? config.outcomes : []) if (!outcome?.key) errors.push('has an outcome without key');
    return errors;
  },
  async execute({ ctx, step, label, config, tenantId, caseId, deps }) {
    const taskId = ctx.rand.uuidv4();
    const slaMs = durationMs(config.sla);
    const outcomes: TaskOutcome[] = Array.isArray(config.outcomes) && config.outcomes.length
      ? config.outcomes.map((o: any) => ({ key: String(o.key), label: String(o.label ?? o.key), requiresReason: !!o.requiresReason, needsSecondApproval: !!o.needsSecondApproval }))
      : DEFAULT_REVIEW_OUTCOMES(config.requireCommentOnReject !== false);

    await ctx.run(`task-${label}`, async () => {
      await deps.repository.createTask(tenantId, {
        id: taskId, caseId, stepId: step.id, audience: 'member',
        kind: String(config.kind ?? 'review'),
        title: String(config.title ?? step.name),
        description: config.description ? String(config.description) : null,
        queueRole: String(config.assignTo?.role),
        authority: config.authority === 'high' ? 'high' : 'standard',
        outcomes,
        dueAt: slaMs ? new Date(Date.now() + slaMs) : null,
        escalateToRole: config.escalateTo?.role ? String(config.escalateTo.role) : null,
      });
      await deps.repository.updateCase(tenantId, caseId, { status: 'in_review' });
      await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'task.created', { type: 'task', id: taskId, title: String(config.title ?? step.name) }, { queue: config.assignTo?.role, authority: config.authority ?? 'standard' }, caseId);
    });

    const signal = await awaitWithEscalation({ ctx, label, config, tenantId, caseId, deps } as StepContext, taskId, slaMs);
    await ctx.run(`reviewed-${label}`, () => deps.repository.updateCase(tenantId, caseId, { status: 'in_progress' }));
    const event = signal.outcome === 'approve' ? 'review_approved' : signal.outcome === 'reject' ? 'review_rejected' : signal.outcome;
    return { event, output: signal };
  },
};

/**
 * Work for the team that is not a decision (docs/plans/06): instructions, routed to a role queue — or, with
 * `sameAssigneeAs: siblings`, to whoever took the same step for the other items of the parent case (one relationship
 * manager handles every party of an application).
 */
const workTask: EngineComponent = {
  definition: {
    type: 'task', version: 1, title: 'Task', description: 'Work for the team (checks, calls, paperwork), routed to a role or to the same person for every item.',
    icon: 'ListChecks', category: 'people', kind: 'human', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['assignTo'],
      properties: {
        title: text('Task title'),
        description: text('Instructions', undefined, 'textarea'),
        assignTo: { type: 'object', title: 'Route to', properties: { role: role('Role queue') }, required: ['role'] },
        sameAssigneeAs: { type: 'string', title: 'Same person', enum: ['', 'siblings'], 'x-enum-labels': ['—', 'Whoever handles this step for the other items (for each)'] },
        sla: duration('SLA', 'escalates when exceeded, e.g. P2D'),
        escalateTo: { type: 'object', title: 'Escalate to', properties: { role: role('Role queue') } },
        outcomes: { type: 'array', title: 'Outcomes', description: 'empty = Done', items: OUTCOME_ITEM },
      },
    },
    defaults: { title: 'Task', assignTo: { role: 'reviewer' } },
    summary: 'Queue {{assignTo.role}}',
    events: { fromConfig: 'outcomes', defaults: ['done'] },
  },
  validate: (config, context) => {
    const queue = config.assignTo?.role;
    if (!queue) return ['needs assignTo.role'];
    return context.roles && !String(queue).startsWith('=') && !context.roles.includes(queue) ? [`routes to unknown role "${queue}"`] : [];
  },
  async execute({ ctx, step, label, config, tenantId, caseId, deps }) {
    const taskId = ctx.rand.uuidv4();
    const slaMs = durationMs(config.sla);
    const outcomes: TaskOutcome[] = Array.isArray(config.outcomes) && config.outcomes.length
      ? config.outcomes.map((o: any) => ({ key: String(o.key), label: String(o.label ?? o.key), requiresReason: !!o.requiresReason }))
      : [{ key: 'done', label: 'Done' }];
    const sticky = config.sameAssigneeAs === 'siblings';
    await ctx.run(`task-${label}`, async () => {
      const assigneeId = sticky ? await deps.repository.siblingAssignee(tenantId, caseId, step.id) : null;
      await deps.repository.createTask(tenantId, {
        id: taskId, caseId, stepId: step.id, audience: 'member', kind: 'task', title: String(config.title ?? step.name),
        description: config.description ? String(config.description) : null, queueRole: String(config.assignTo?.role), outcomes,
        dueAt: slaMs ? new Date(Date.now() + slaMs) : null, escalateToRole: config.escalateTo?.role ? String(config.escalateTo.role) : null,
        routing: sticky ? { sameAssigneeAs: 'siblings' } : null, assigneeId, status: assigneeId ? 'claimed' : 'open',
      });
      await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'task.created', { type: 'task', id: taskId, title: String(config.title ?? step.name) }, { queue: config.assignTo?.role, assignee: assigneeId }, caseId);
    });
    const signal = await awaitWithEscalation({ ctx, label, config, tenantId, caseId, deps } as StepContext, taskId, slaMs);
    return { event: signal.outcome, output: signal };
  },
};

/** Wait for a task's decision; when the SLA passes, re-queue the task to the escalation role and keep waiting. */
export async function awaitWithEscalation({ ctx, label, config, tenantId, caseId, deps }: StepContext, taskId: string, slaMs: number | null): Promise<TaskSignal> {
  const promise = ctx.promise<TaskSignal>(`task:${taskId}`);
  if (!slaMs || !config.escalateTo?.role) return promise.get();
  try {
    return await promise.get().orTimeout(slaMs);
  } catch (error) {
    if (!(error instanceof restate.TimeoutError)) throw error;
    await ctx.run(`escalate-${label}`, async () => {
      const task = await deps.repository.getTask(tenantId, taskId);
      if (task && !['completed', 'cancelled'].includes(task.status)) {
        await deps.repository.updateTask(tenantId, taskId, { status: 'escalated', queueRole: String(config.escalateTo.role), assigneeId: null, escalatedAt: new Date() });
        await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'task.escalated', { type: 'task', id: taskId }, { to: config.escalateTo.role, sla: config.sla }, caseId);
      }
    });
    return promise.get();
  }
}

// --- client ------------------------------------------------------------------------------------------------------------

const REQUEST_ITEM = {
  type: 'object',
  properties: {
    key: { type: 'string', title: 'Key' },
    label: { type: 'string', title: 'Question / document' },
    type: { type: 'string', title: 'Answer type', enum: ['text', 'file'], 'x-enum-labels': ['Text', 'File upload'] },
  },
} as const;

const clientRequest: EngineComponent = {
  definition: {
    type: 'client.request', version: 1, title: 'Request to client', description: 'Asks the applicant for information or documents in their portal, with reminder and expiry.',
    icon: 'MessageSquareMore', category: 'client', kind: 'client', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['items'],
      properties: {
        title: text('Title'),
        description: text('Explanation for the client', undefined, 'textarea'),
        items: { type: 'array', title: 'What to ask', items: REQUEST_ITEM, minItems: 1 },
        remindAfter: duration('Remind after', 'e.g. P2D'),
        expiresAfter: duration('Expire after', 'e.g. P7D'),
      },
    },
    defaults: { title: 'Please send us a document', items: [{ key: 'document', label: 'Proof of address', type: 'file' }], remindAfter: 'P2D', expiresAfter: 'P7D' },
    summary: '{{title}} · expires {{expiresAfter}}',
    events: { static: ['completed', 'expired'] },
  },
  validate: (config) => (Array.isArray(config.items) && config.items.length ? [] : ['needs items']),
  async execute({ ctx, step, label, config, tenantId, caseId, deps }) {
    const taskId = ctx.rand.uuidv4();
    const remindMs = durationMs(config.remindAfter);
    const expireMs = durationMs(config.expiresAfter);

    await ctx.run(`client-task-${label}`, async () => {
      const kase = (await deps.repository.getCase(tenantId, caseId))!;
      await deps.repository.createTask(tenantId, {
        id: taskId, caseId, stepId: step.id, audience: 'client', kind: 'client_request',
        title: String(config.title ?? step.name), description: config.description ? String(config.description) : null,
        assigneeId: kase.applicantId, requestItems: config.items, dueAt: expireMs ? new Date(Date.now() + expireMs) : null,
      });
      await deps.repository.updateCase(tenantId, caseId, { status: 'pending_client' });
      await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'client_request.created', { type: 'task', id: taskId, title: String(config.title ?? step.name) }, {}, caseId);
      if (kase.applicantEmail) {
        const tenant = await deps.loadTenant(tenantId);
        const link = deps.notifier.requestLink(tenant, kase);
        await deps.notifier.send(tenant, kase.applicantEmail, link.subject,
          [String(config.title ?? step.name), ...(config.description ? [String(config.description)] : [])],
          { label: link.label, url: link.url });
      }
    });

    const promise = ctx.promise<TaskSignal>(`task:${taskId}`);
    const expire = async () => {
      await ctx.run(`expire-${label}`, async () => {
        await deps.repository.updateTask(tenantId, taskId, { status: 'expired' });
        await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'client_request.expired', { type: 'task', id: taskId }, {}, caseId);
      });
      return { event: 'expired', output: { expired: true } };
    };

    let signal: TaskSignal;
    try {
      if (remindMs && expireMs && remindMs < expireMs) {
        try {
          signal = await promise.get().orTimeout(remindMs);
        } catch (error) {
          if (!(error instanceof restate.TimeoutError)) throw error;
          await ctx.run(`remind-${label}`, async () => {
            const kase = (await deps.repository.getCase(tenantId, caseId))!;
            if (kase.applicantEmail) {
              const tenant = await deps.loadTenant(tenantId);
              const link = deps.notifier.requestLink(tenant, kase);
              await deps.notifier.send(tenant, kase.applicantEmail, `Reminder: ${link.subject.charAt(0).toLowerCase()}${link.subject.slice(1)}`,
                [`We still need: ${String(config.title ?? step.name)}.`], { label: link.label, url: link.url });
            }
            await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'client_request.reminded', { type: 'task', id: taskId }, {}, caseId);
          });
          signal = await promise.get().orTimeout(expireMs - remindMs);
        }
      } else if (expireMs) {
        signal = await promise.get().orTimeout(expireMs);
      } else {
        signal = await promise.get();
      }
    } catch (error) {
      if (error instanceof restate.TimeoutError) return expire();
      throw error;
    }

    await ctx.run(`answered-${label}`, () => deps.repository.updateCase(tenantId, caseId, { status: 'in_progress' }));
    return { event: 'completed', output: signal.response ?? {} };
  },
};

export const BUILTIN_COMPONENTS: EngineComponent[] = [
  start, end, conditional, calculate, dataMap, wait, email, caseUpdate, caseDecision, review, workTask, clientRequest, ...PARTY_COMPONENTS, ...CLIENT_APP_COMPONENTS, ...INTEGRATION_COMPONENTS, ...EVENT_COMPONENTS,
];
