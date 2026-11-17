import * as restate from '@restatedev/restate-sdk/fetch';
import { evaluate, resolveConfig } from '../expressions';
import { durationMs } from '../durations';
import type { EngineComponent, TaskSignal } from './types';
import { WORKFLOW_ACTOR } from './types';

/**
 * Related parties and fan-out (docs/plans/06): a workflow collects the people involved (co-applicants, guarantors,
 * UBOs, directors), then runs a sub-workflow per person as child cases and waits for them.
 */

const expression = (title: string, description?: string) => ({ type: 'string', title, description, 'x-widget': 'expression' } as const);

/** The applicant declares the related parties (invitations go out as they add them), then confirms the list. */
const partiesCollect: EngineComponent = {
  definition: {
    type: 'parties.collect', version: 1, title: 'Collect related parties', description: 'The applicant lists co-applicants, guarantors, directors or beneficial owners; each is invited to join.',
    icon: 'Users', category: 'people', kind: 'client', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['roles'],
      properties: {
        title: { type: 'string', title: 'Title for the applicant' },
        roles: { type: 'array', title: 'Roles', items: { type: 'string' }, minItems: 1 },
        minimum: { type: 'object', title: 'Minimum per role', additionalProperties: { type: 'integer', minimum: 0 } },
        expiresAfter: { type: 'string', title: 'Expire after', 'x-widget': 'duration' },
      },
    },
    defaults: { title: 'Tell us who else is involved', roles: ['co_applicant'], minimum: {} },
    summary: 'Parties: {{roles}}',
    events: { static: ['collected', 'expired'] },
  },
  validate: (config) => (Array.isArray(config.roles) && config.roles.length ? [] : ['needs roles']),
  async execute({ ctx, step, label, config, tenantId, caseId, deps }) {
    const taskId = ctx.rand.uuidv4();
    await ctx.run(`parties-task-${label}`, async () => {
      const kase = (await deps.repository.getCase(tenantId, caseId))!;
      await deps.repository.createTask(tenantId, {
        id: taskId, caseId, stepId: step.id, audience: 'client', kind: 'parties', title: String(config.title ?? step.name),
        description: `Add the people with these roles: ${(config.roles as string[]).join(', ')}. Each of them receives their own invitation.`,
        assigneeId: kase.applicantId, requestItems: [{ key: 'parties', label: 'Related parties', type: 'parties', roles: config.roles, minimum: config.minimum ?? {} } as never],
      });
      await deps.repository.updateCase(tenantId, caseId, { status: 'pending_client' });
      await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'client_request.created', { type: 'task', id: taskId, title: String(config.title ?? step.name) }, { kind: 'parties' }, caseId);
      if (kase.applicantEmail) {
        const tenant = await deps.loadTenant(tenantId);
        const link = deps.notifier.requestLink(tenant, kase);
        await deps.notifier.send(tenant, kase.applicantEmail, link.subject, [String(config.title ?? step.name)], { label: link.label, url: link.url });
      }
    });
    const promise = ctx.promise<TaskSignal>(`task:${taskId}`);
    const expireMs = durationMs(config.expiresAfter);
    let signal: TaskSignal;
    try {
      signal = expireMs ? await promise.get().orTimeout(expireMs) : await promise.get();
    } catch (error) {
      if (!(error instanceof restate.TimeoutError)) throw error;
      await ctx.run(`parties-expired-${label}`, () => deps.repository.updateTask(tenantId, taskId, { status: 'expired' }));
      return { event: 'expired', output: { expired: true } };
    }
    const parties = await ctx.run(`parties-${label}`, async () => {
      await deps.repository.updateCase(tenantId, caseId, { status: 'in_progress' });
      return (await deps.repository.partiesOfCase(tenantId, caseId))
        .filter((p) => (config.roles as string[]).includes(p.role) && p.status !== 'removed')
        .map((p) => ({ id: p.id, personId: p.personId, role: p.role, email: p.email, name: p.name, share: p.share }));
    });
    return { event: 'collected', output: { parties, count: parties.length, by: signal.by ?? null } };
  },
};

/** Wait until a party accepted their invitation (their consent to take part), e.g. before verifying them. */
const partiesWait: EngineComponent = {
  definition: {
    type: 'parties.wait', version: 1, title: 'Wait for the party to join', description: 'Continues when the person accepted their invitation.',
    icon: 'UserCheck', category: 'people', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: { type: 'object', required: ['party'], properties: { party: expression('Party', 'e.g. {{input.partyId}}'), timeout: { type: 'string', title: 'Give up after', 'x-widget': 'duration' } } },
    defaults: { party: '{{input.partyId}}', timeout: 'P14D' },
    summary: 'Until {{party}} joins',
    events: { static: ['joined', 'expired'] },
  },
  validate: (config) => (config.party ? [] : ['needs a party']),
  async execute({ ctx, label, config, tenantId, deps }) {
    const partyId = String(config.party);
    const already = await ctx.run(`party-state-${label}`, async () => (await deps.repository.getParty(tenantId, partyId))?.status ?? null);
    if (!already) throw new restate.TerminalError(`Party ${partyId} not found`);
    if (already === 'invited') {
      const timeout = durationMs(config.timeout);
      const promise = ctx.promise<TaskSignal>(`party:${partyId}:joined`);
      try {
        if (timeout) await promise.get().orTimeout(timeout);
        else await promise.get();
      } catch (error) {
        if (!(error instanceof restate.TimeoutError)) throw error;
        return { event: 'expired', output: { partyId, expired: true } };
      }
    }
    return { event: 'joined', output: { partyId } };
  },
};

/** Record the outcome of a party's part (status, e.g. their verification result). */
const partiesUpdate: EngineComponent = {
  definition: {
    type: 'parties.update', version: 1, title: 'Update party', description: "Sets a party's status and data (e.g. their verification result).",
    icon: 'UserCog', category: 'people', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['party'],
      properties: {
        party: expression('Party', 'e.g. {{input.partyId}}'),
        status: { type: 'string', title: 'Status', enum: ['in_progress', 'completed', 'declined'] },
        data: { type: 'object', title: 'Data', additionalProperties: { type: 'string', 'x-expression': true } },
      },
    },
    defaults: { party: '{{input.partyId}}', status: 'completed', data: {} },
    summary: '{{party}} → {{status}}',
    events: { static: ['done'] },
  },
  validate: (config) => (config.party ? [] : ['needs a party']),
  async execute({ ctx, label, config, tenantId, caseId, deps }) {
    const partyId = String(config.party);
    await ctx.run(`party-update-${label}`, async () => {
      const party = await deps.repository.getParty(tenantId, partyId);
      if (!party) throw new restate.TerminalError(`Party ${partyId} not found`);
      await deps.repository.updateParty(tenantId, partyId, {
        ...(config.status ? { status: config.status } : {}),
        data: { ...party.data, ...((config.data ?? {}) as Record<string, unknown>) },
      });
      await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'party.updated', { type: 'party', id: partyId, role: party.role }, { status: config.status ?? party.status }, party.caseId ?? caseId);
    });
    return { event: 'done', output: { partyId, status: config.status ?? null } };
  },
};

/**
 * Run a published workflow as a child case; wait for it (default) and continue with its outputs, or start it and go on
 * (`wait: false`, e.g. title tracking that lasts weeks while the deal moves on).
 */
async function callWorkflow({ ctx, step, label, tenantId, caseId, deps }: Parameters<EngineComponent['execute']>[0], workflowId: string, inputs: Record<string, unknown>, applicant: unknown, wait: boolean) {
  const start = deps.services.startChildCase;
  if (!start) throw new restate.TerminalError('Child cases are not available in this engine');
  const promise = `child:${step.id}:${label}`.slice(0, 150);
  const child = await ctx.run(`child-${label}`, () => start({
    tenantId, parentCaseId: caseId, parentStepId: step.id, workflowId, data: inputs,
    applicantId: applicant ? String(applicant) : null, callbackPromise: wait ? promise : null,
  }));
  if (!wait) return { event: 'started', output: child };
  const signal = await ctx.promise<TaskSignal>(promise).get();
  const outputs = (signal.output?.outputs ?? {}) as Record<string, unknown>;
  return { event: signal.outcome === 'failed' ? 'failed' : 'completed', output: { ...child, ...(signal.output ?? {}), ...outputs } };
}

const workflowCall: EngineComponent = {
  definition: {
    type: 'workflow.call', version: 1, title: 'Run a sub-workflow', description: 'Starts a published workflow as a child case and continues when it ends (or at once).',
    icon: 'Workflow', category: 'flow', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['workflowId'],
      properties: {
        workflowId: { type: 'string', title: 'Workflow', 'x-widget': 'workflow' },
        inputs: { type: 'object', title: 'Inputs', additionalProperties: { type: 'string', 'x-expression': true } },
        applicant: expression('Person the child case is about (user id)', 'default: the same applicant'),
        wait: { type: 'boolean', title: 'Wait until it ends', description: 'off: start it and continue at once (event started)', default: true },
      },
    },
    defaults: { inputs: {}, wait: true },
    summary: 'Runs {{workflowId}}',
    events: { static: ['completed', 'failed', 'started'] },
  },
  validate: (config) => (config.workflowId ? [] : ['needs a workflow']),
  execute: (context) => callWorkflow(context, String(context.config.workflowId), (context.config.inputs ?? {}) as Record<string, unknown>, context.config.applicant, context.config.wait !== false),
};

/**
 * An institution's function (a published workflow with `function: true`) used as a step, `function:<workflow id>`:
 * its inputs are the step's fields, its outputs the step's result (docs/plans/12). A connector of their own, made of
 * steps (HTTP calls, mappings, reviews) and reused across workflows.
 */
export function functionComponent(workflowId: string, info?: { name: string; description?: string; inputs?: Array<{ id: string; name?: string; label?: string; description?: string; required?: boolean }> }): EngineComponent {
  const inputs = info?.inputs ?? [];
  return {
    definition: {
      type: `function:${workflowId}`, version: 1, title: info?.name ?? 'Function', description: info?.description || 'A function of your institution (a workflow used as a step).',
      icon: 'SquareFunction', category: 'function', kind: 'automatic', source: { kind: 'function', workflowId },
      configSchema: {
        type: 'object',
        properties: {
          inputs: {
            type: 'object', title: 'Inputs',
            ...(inputs.length ? { properties: Object.fromEntries(inputs.map((i) => [i.id, { type: 'string', title: i.label ?? i.name ?? i.id, description: i.description, 'x-expression': true }])), required: inputs.filter((i) => i.required).map((i) => i.id) } : {}),
            additionalProperties: { type: 'string', 'x-expression': true },
          },
          wait: { type: 'boolean', title: 'Wait until it ends', default: true },
        },
      },
      defaults: { inputs: Object.fromEntries(inputs.map((i) => [i.id, ''])), wait: true },
      summary: info?.name ?? 'Function',
      events: { static: ['completed', 'failed', 'started'] },
    },
    execute: (context) => callWorkflow(context, workflowId, (context.config.inputs ?? {}) as Record<string, unknown>, null, context.config.wait !== false),
  };
}

/**
 * Multi-instance over a list (BPMN multi-instance, docs/plans/06): one child case of a published workflow per item,
 * in parallel; continues when every child ended (`completed`), or `failed` when any child failed and
 * `onItemFailure: fail`. Inputs are evaluated per item with `item` and `index` in scope.
 */
const forEach: EngineComponent = {
  definition: {
    type: 'foreach', version: 1, title: 'For each', description: 'Runs a sub-workflow for every item of a list (e.g. every related party) and waits for all of them.',
    icon: 'Repeat', category: 'flow', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['items', 'workflowId'],
      properties: {
        items: expression('Items', 'JSONata list, e.g. steps.parties.parties'),
        workflowId: { type: 'string', title: 'Workflow per item', 'x-widget': 'workflow' },
        inputs: { type: 'object', title: 'Inputs per item', description: 'expressions with item and index, e.g. = item.id', additionalProperties: { type: 'string', 'x-expression': true } },
        applicant: expression('Person of each child case', 'e.g. = item.personId'),
        onItemFailure: { type: 'string', title: 'When an item fails', enum: ['fail', 'continue'], default: 'fail' },
      },
    },
    defaults: { items: '= steps.parties.parties', inputs: { partyId: '= item.id' }, applicant: '= item.personId', onItemFailure: 'fail' },
    summary: 'For each of {{items}} → {{workflowId}}',
    events: { static: ['completed', 'failed'] },
  },
  resolveConfig: false,
  validate: (config) => (config.items && config.workflowId ? [] : ['needs items and a workflow']),
  async execute({ ctx, step, label, config, vars, tenantId, caseId, deps }) {
    const start = deps.services.startChildCase;
    if (!start) throw new restate.TerminalError('Child cases are not available in this engine');
    const items = await ctx.run(`items-${label}`, async () => {
      const value = String(config.items).trim().startsWith('=') ? await evaluate(String(config.items), vars) : await resolveConfig(config.items, vars);
      return (Array.isArray(value) ? value : value ? [value] : []) as unknown[];
    });
    const children = [];
    for (const [index, item] of items.entries()) {
      const scope = { ...vars, item, index };
      const promise = `child:${step.id}:${label}:${index}`.slice(0, 150);
      const child = await ctx.run(`child-${label}-${index}`, async () => {
        const inputs = await resolveConfig((config.inputs ?? {}) as Record<string, unknown>, scope);
        const applicant = config.applicant ? await resolveConfig(config.applicant, scope) : null;
        // Items that are parties get their own case (the party sees their tasks there).
        const candidate = (item as { id?: string } | null)?.id;
        const partyId = candidate && /^[0-9a-f-]{36}$/.test(candidate) && (await deps.repository.getParty(tenantId, candidate)) ? candidate : null;
        return start({
          tenantId, parentCaseId: caseId, parentStepId: step.id, workflowId: String(config.workflowId), data: inputs,
          applicantId: applicant ? String(applicant) : null, partyId, callbackPromise: promise,
        });
      });
      children.push({ ...child, promise });
    }
    const results = [];
    for (const [index, child] of children.entries()) {
      const signal = await ctx.promise<TaskSignal>(child.promise).get();
      results.push({ index, caseId: child.caseId, reference: child.reference, outcome: signal.outcome, status: (signal.output as { status?: string } | undefined)?.status ?? null });
    }
    const failed = results.filter((r) => r.outcome === 'failed' || r.status === 'failed');
    return { event: failed.length && config.onItemFailure !== 'continue' ? 'failed' : 'completed', output: { items: results, count: results.length, failed: failed.length } };
  },
};

/**
 * Send one of the institution's forms to a person (the applicant, or a related party) and continue with their answers
 * (docs/plans/06; replaces the legacy form/wizard nodes). The form is filled in the portal.
 */
const formRequest: EngineComponent = {
  definition: {
    type: 'form.request', version: 1, title: 'Send a form', description: 'A person fills one of your forms in their portal; the answers are available to the next steps.',
    icon: 'ClipboardList', category: 'client', kind: 'client', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['formId'],
      properties: {
        formId: { type: 'string', title: 'Form', 'x-widget': 'form' },
        title: { type: 'string', title: 'Title for the person' },
        party: expression('Party (empty = the applicant)', 'e.g. {{input.partyId}}'),
        expiresAfter: { type: 'string', title: 'Expire after', 'x-widget': 'duration' },
      },
    },
    defaults: { title: 'Please fill in this form' },
    summary: 'Form {{formId}}',
    events: { static: ['submitted', 'expired'] },
  },
  validate: (config) => (config.formId ? [] : ['needs a form']),
  async execute({ ctx, step, label, config, tenantId, caseId, deps }) {
    const taskId = ctx.rand.uuidv4();
    await ctx.run(`form-task-${label}`, async () => {
      const kase = (await deps.repository.getCase(tenantId, caseId))!;
      let assigneeId = kase.applicantId;
      let email = kase.applicantEmail;
      if (config.party) {
        const party = await deps.repository.getParty(tenantId, String(config.party));
        if (!party) throw new restate.TerminalError(`Party ${config.party} not found`);
        assigneeId = party.personId;
        email = party.email;
      }
      await deps.repository.createTask(tenantId, {
        id: taskId, caseId, stepId: step.id, audience: 'client', kind: 'form', title: String(config.title ?? step.name),
        assigneeId, requestItems: [{ key: 'form', label: String(config.title ?? step.name), type: 'form', formId: String(config.formId) } as never],
        dueAt: durationMs(config.expiresAfter) ? new Date(Date.now() + durationMs(config.expiresAfter)!) : null,
      });
      await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'client_request.created', { type: 'task', id: taskId, title: String(config.title ?? step.name) }, { kind: 'form', formId: config.formId }, caseId);
      if (email) {
        const tenant = await deps.loadTenant(tenantId);
        const link = deps.notifier.requestLink(tenant, kase);
        await deps.notifier.send(tenant, email, link.subject, [String(config.title ?? step.name)], { label: link.label, url: link.url });
      }
    });
    const promise = ctx.promise<TaskSignal>(`task:${taskId}`);
    const expireMs = durationMs(config.expiresAfter);
    let signal: TaskSignal;
    try {
      signal = expireMs ? await promise.get().orTimeout(expireMs) : await promise.get();
    } catch (error) {
      if (!(error instanceof restate.TimeoutError)) throw error;
      await ctx.run(`form-expired-${label}`, () => deps.repository.updateTask(tenantId, taskId, { status: 'expired' }));
      return { event: 'expired', output: { expired: true } };
    }
    const answers = ((signal.response ?? {}) as { form?: Record<string, unknown> }).form ?? {};
    return { event: 'submitted', output: { answers } };
  },
};

export const PARTY_COMPONENTS: EngineComponent[] = [partiesCollect, partiesWait, partiesUpdate, workflowCall, forEach, formRequest];
