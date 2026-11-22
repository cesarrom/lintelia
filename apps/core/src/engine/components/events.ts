import * as restate from '@restatedev/restate-sdk/fetch';
import { durationMs } from '../durations';
import { evaluate, resolveConfig } from '../expressions';
import { cancelEventWait, keysOf, registerEventWait, type DeliveredEvent } from '../events';
import { getComponent, validateComponentConfig } from './index';
import { publishLiveMessage } from '../../live/hub';
import { WORKFLOW_ACTOR, type EngineComponent, type StepResult, type TaskSignal } from './types';

/**
 * Data from outside reaching a running case (docs/plans/17 §3): `event.wait` waits for an event *about this case* — it
 * names the case by its business keys, not by its id — and `poll` asks another system until a condition holds.
 */
const EVENT_TYPE = /^[a-z0-9][a-z0-9_.:/-]{0,159}$/i;

const eventWait: EngineComponent = {
  definition: {
    type: 'event.wait', version: 1, title: 'Wait for an event',
    description: 'Pauses until an event about this case arrives — from your systems (api:<type>), a connector or the platform — matched by the case\'s business keys (e.g. its loan id).',
    icon: 'Radio', category: 'flow', kind: 'timer', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['event'],
      properties: {
        event: { type: 'string', title: 'Event', description: 'its type, e.g. api:loan.payment, connector:loanpro/payment.posted, client.flagged' },
        match: {
          type: 'object', title: 'About this case when', 'x-widget': 'keyValue', additionalProperties: { type: 'string' },
          description: 'case key → the event\'s value for it (JSONata over the event), e.g. loan → = data.loanId',
        },
        filter: { type: 'string', title: 'Only if', description: 'JSONata over the event, e.g. data.amount > 0', 'x-widget': 'expression' },
        timeout: { type: 'string', title: 'Give up after', description: 'ISO-8601 duration, e.g. P40D (empty: wait forever)', 'x-widget': 'duration' },
        buffer: { type: 'string', title: 'Also accept events received up to', description: 'this long before the step waits (e.g. PT1H); empty: only events after', 'x-widget': 'duration' },
        consume: { type: 'boolean', title: 'One case only', description: 'the first waiting case takes the event (a work queue); otherwise every matching case gets it' },
      },
    },
    defaults: { event: 'api:payment.received', match: {}, timeout: 'P30D' },
    summary: 'Waits for {{event}}',
    events: { static: ['received', 'timeout'] },
  },
  resolveConfig: false,
  validate: (config) => {
    const errors: string[] = [];
    if (!EVENT_TYPE.test(String(config.event ?? ''))) errors.push('needs an event type (e.g. api:loan.payment)');
    for (const key of ['timeout', 'buffer']) {
      try {
        durationMs(config[key]);
      } catch {
        errors.push(`${key} must be an ISO-8601 duration`);
      }
    }
    return errors;
  },
  async execute({ ctx, step, label, tenantId, caseId, deps }) {
    const config = step.config as Record<string, any>;
    const eventType = String(config.event);
    const promise = `event:${step.id}:${label}`.slice(0, 150);
    const early = await ctx.run(`event-wait-${label}`, async () => {
      const db = deps.repository.db(tenantId);
      const keys = await keysOf(db, caseId);
      const match: Record<string, { expression: string; value: string }> = {};
      for (const [name, expression] of Object.entries((config.match ?? {}) as Record<string, string>)) {
        if (keys[name] === undefined) throw new restate.TerminalError(`The case has no key "${name}" yet: declare it under correlation (or set it with case.update) before waiting`);
        match[name] = { expression: String(expression), value: keys[name] };
      }
      const delivered = await registerEventWait(db, {
        caseId, stepId: step.id, promise, eventType, match, filter: config.filter ? String(config.filter) : null, consume: config.consume === true,
        bufferMs: durationMs(config.buffer) ?? 0,
      });
      await deps.audit.record(tenantId, WORKFLOW_ACTOR, delivered ? 'case.event_received' : 'case.waiting_for_event', { type: 'case', id: caseId },
        { event: eventType, ...(delivered ? { eventId: delivered.id, early: true } : { keys: Object.fromEntries(Object.entries(match).map(([k, v]) => [k, v.value])), timeout: config.timeout ?? null }) }, caseId);
      return delivered;
    });
    let event: DeliveredEvent | null = early;
    if (!event) {
      const timeout = durationMs(config.timeout);
      try {
        const signal = timeout ? await ctx.promise<TaskSignal>(promise).get().orTimeout(timeout) : await ctx.promise<TaskSignal>(promise).get();
        event = signal.output as unknown as DeliveredEvent;
        await ctx.run(`event-received-${label}`, () => deps.audit.record(tenantId, WORKFLOW_ACTOR, 'case.event_received', { type: 'case', id: caseId }, { event: eventType, eventId: event!.id }, caseId));
      } catch (error) {
        if (!(error instanceof restate.TimeoutError)) throw error;
        // Delivered at the last moment: the event wins over the timeout.
        event = await ctx.run(`event-timeout-${label}`, async () => {
          const raced = await cancelEventWait(deps.repository.db(tenantId), caseId, promise, eventType);
          if (!raced) await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'case.event_timed_out', { type: 'case', id: caseId }, { event: eventType }, caseId);
          return raced;
        });
        if (!event) return { event: 'timeout', output: { event: eventType, timedOut: true } };
      }
    }
    return { event: 'received', output: { ...(event.data ?? {}), event: { id: event.id, type: event.type, source: event.source, receivedAt: event.receivedAt } } };
  },
};

const poll: EngineComponent = {
  definition: {
    type: 'poll', version: 1, title: 'Poll until',
    description: 'Calls a step (a connector, a function, client data…) every so often until a condition holds — for systems that cannot call back.',
    icon: 'RefreshCcw', category: 'flow', kind: 'timer', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['call', 'until', 'every'],
      properties: {
        call: {
          type: 'object', title: 'Call', required: ['type'],
          description: 'the step to run at each attempt: its type and config, e.g. { type: connector:http/request, config: { … } }',
          properties: { type: { type: 'string', title: 'Step type', description: 'e.g. connector:http/request, client.data, function:<workflow id>' }, config: { type: 'object', title: 'Its config', description: 'JSON, as the step itself takes it', 'x-widget': 'json' } },
        },
        until: { type: 'string', title: 'Until', description: 'JSONata over the call\'s result (and attempt), e.g. status = "ready"', 'x-widget': 'expression' },
        every: { type: 'string', title: 'Every', description: 'ISO-8601 duration between attempts, e.g. PT10M', 'x-widget': 'duration' },
        timeout: { type: 'string', title: 'Give up after', description: 'ISO-8601 duration, e.g. P2D', 'x-widget': 'duration' },
        maxAttempts: { type: 'integer', title: 'At most', description: 'attempts (default 100)', minimum: 1, maximum: 10000 },
      },
    },
    defaults: { call: { type: 'client.data', config: { collection: 'accounts' } }, until: 'count > 0', every: 'PT10M', timeout: 'P1D' },
    summary: 'Polls {{call.type}} every {{every}}',
    events: { static: ['done', 'timeout', 'failed'] },
  },
  resolveConfig: false,
  validate: (config, context) => {
    const errors: string[] = [];
    const call = config.call as { type?: string; config?: Record<string, unknown> } | undefined;
    const component = call?.type ? getComponent(call.type) : null;
    if (!call?.type) errors.push('needs the step to call (call.type)');
    else if (!component) errors.push(`calls an unknown step type "${call.type}"`);
    else if (component.definition.kind !== 'automatic') errors.push(`"${component.definition.title}" cannot be polled (only automatic steps: connectors, functions, data)`);
    else errors.push(...validateComponentConfig(component, call.config ?? {}, context).map((e) => `call: ${e}`));
    if (!String(config.until ?? '').trim()) errors.push('needs a condition (until)');
    try {
      if (!durationMs(config.every) || durationMs(config.every)! < 1000) errors.push('every must be at least PT1S');
      durationMs(config.timeout);
    } catch {
      errors.push('every and timeout must be ISO-8601 durations');
    }
    return errors;
  },
  async execute({ ctx, step, label, vars, tenantId, caseId, deps }): Promise<StepResult> {
    const config = step.config as Record<string, any>;
    const call = config.call as { type: string; config?: Record<string, unknown> };
    const component = getComponent(call.type);
    if (!component) throw new restate.TerminalError(`Unknown step type ${call.type}`);
    const every = durationMs(config.every) ?? 600_000;
    const timeout = durationMs(config.timeout);
    const maxAttempts = Number(config.maxAttempts ?? 100);
    const started = await ctx.date.now();
    let last: StepResult | null = null;
    let attempts = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      const at = `${label}/${attempt}`;
      const resolved = component.resolveConfig === false ? (call.config ?? {}) : await ctx.run(`poll-config-${at}`, () => resolveConfig(call.config ?? {}, vars)) as Record<string, any>;
      last = await component.execute({ ctx, step: { id: step.id, name: step.name, type: call.type, config: call.config ?? {}, events: [] }, label: at, config: resolved, vars, tenantId, caseId, deps });
      const output = last.output;
      if (/fail|error/i.test(last.event ?? '')) return { event: 'failed', output: { attempts: attempt, result: output, failedWith: last.event } };
      const done = await ctx.run(`poll-until-${at}`, async () => {
        try {
          const scope = output && typeof output === 'object' && !Array.isArray(output) ? { ...(output as Record<string, unknown>), result: output, attempt } : { result: output, attempt };
          return !!(await evaluate(String(config.until), scope));
        } catch {
          return false;
        }
      });
      if (done) {
        await ctx.run(`poll-done-${label}`, () => deps.audit.record(tenantId, WORKFLOW_ACTOR, 'case.poll_done', { type: 'case', id: caseId }, { step: step.id, call: call.type, attempts: attempt }, caseId));
        return { event: 'done', output: { ...(output && typeof output === 'object' && !Array.isArray(output) ? output as Record<string, unknown> : {}), result: output, attempts: attempt } };
      }
      const now = await ctx.date.now();
      if (timeout !== null && now + every - started > timeout) break;
      await ctx.sleep(every, `poll-sleep-${at}`);
    }
    await ctx.run(`poll-timeout-${label}`, () => deps.audit.record(tenantId, WORKFLOW_ACTOR, 'case.poll_timed_out', { type: 'case', id: caseId }, { step: step.id, call: call.type }, caseId));
    return { event: 'timeout', output: { attempts, result: last?.output ?? null, timedOut: true } };
  },
};

const CHANNEL = /^[a-z][a-z0-9_-]{0,63}$/;
const MAX_LIVE_PAYLOAD = 4_000;

/**
 * A workflow tells someone something as it happens (docs/plans/17 §4.4): on a channel of its case (the screen that
 * started it listens from the start, capability URL `{{case.live.<channel>}}` for screens we do not serve), to the
 * applicant, to a member (by default the one who started the case), to a role's members — or to one of the
 * institution's webhook subscriptions, signed like every webhook (`case.message`).
 */
const livePublish: EngineComponent = {
  definition: {
    type: 'live.publish', version: 1, title: 'Send a live message',
    description: 'Tells a screen (or a system) what is happening now: progress, a result, a quote. Screens listening get it at once; late ones get what they missed.',
    icon: 'RadioTower', category: 'communication', kind: 'automatic', source: { kind: 'builtin' },
    configSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'string', title: 'To', enum: ['case', 'applicant', 'member', 'role', 'webhook'],
          'x-enum-labels': ['A channel of this case (the screen following it)', 'The applicant', 'A member (default: who started the case)', 'The members of a role', 'A webhook subscription of the institution'],
        },
        channel: { type: 'string', title: 'Channel', description: 'lower-case, e.g. progress; its address: {{case.live.<channel>}}', 'x-show-if': { to: ['case'] } },
        member: { type: 'string', title: 'Member', description: 'user id or e-mail (default: who started the case)', 'x-expression': true, 'x-show-if': { to: ['member'] } },
        role: { type: 'string', title: 'Role', 'x-widget': 'role', 'x-show-if': { to: ['role'] } },
        subscription: { type: 'string', title: 'Webhook subscription', description: 'its id (Build → Webhooks)', 'x-widget': 'webhook', 'x-show-if': { to: ['webhook'] } },
        payload: { type: 'object', title: 'Message', description: 'field → value (expressions allowed), e.g. text → Checking your ID…', 'x-widget': 'keyValue', additionalProperties: { type: 'string', 'x-expression': true } },
      },
    },
    defaults: { to: 'case', channel: 'progress', payload: { text: 'Working on it…' } },
    summary: 'Tells {{to}} {{channel}}',
    events: { static: ['done', 'failed'] },
  },
  validate: (config) => {
    const errors: string[] = [];
    const to = String(config.to ?? 'case');
    if (!['case', 'applicant', 'member', 'role', 'webhook'].includes(to)) errors.push('to: case, applicant, member, role or webhook');
    if (to === 'case' && !CHANNEL.test(String(config.channel ?? 'progress'))) errors.push('channel: lower-case letters, digits, - and _');
    if (to === 'role' && !config.role) errors.push('needs the role');
    if (to === 'webhook' && !/^[0-9a-f-]{36}$/i.test(String(config.subscription ?? ''))) errors.push('needs the webhook subscription (its id)');
    return errors;
  },
  async execute({ ctx, step, label, config, tenantId, caseId, deps }) {
    const to = String(config.to ?? 'case');
    const payload = (config.payload && typeof config.payload === 'object' ? config.payload : {}) as Record<string, unknown>;
    const result = await ctx.run(`live-${label}`, async () => {
      const db = deps.repository.db(tenantId);
      const kase = (await deps.repository.getCase(tenantId, caseId))!;
      if (to === 'webhook') {
        if (!deps.services.sendCaseMessage) return { delivered: false, error: 'webhooks are not available' };
        const sent = await deps.services.sendCaseMessage({ tenantId, caseId, reference: kase.reference, subscriptionId: String(config.subscription), step: step.id, message: payload });
        await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'case.message_sent', { type: 'case', id: caseId, reference: kase.reference }, { to: 'webhook', subscription: config.subscription, ...sent }, caseId);
        return { to, ...sent };
      }
      if (JSON.stringify(payload).length > MAX_LIVE_PAYLOAD) return { delivered: false, error: 'a live message is limited to 4 kB' };
      let topic: string;
      if (to === 'applicant') {
        if (!kase.applicantId) return { delivered: false, error: 'the case has no applicant' };
        topic = `client/${kase.applicantId}/messages`;
      } else if (to === 'member') {
        let memberId = kase.initiatedByType === 'member' ? kase.initiatedById : null;
        if (config.member) {
          const who = String(config.member);
          const found = /^[0-9a-f-]{36}$/i.test(who) ? await deps.repository.userById(tenantId, who) : await deps.repository.memberByEmail(tenantId, who);
          memberId = found && found.kind === 'member' ? found.id : null;
        }
        if (!memberId) return { delivered: false, error: 'no member to tell' };
        topic = `member/${memberId}/messages`;
      } else if (to === 'role') {
        topic = `queue/${String(config.role)}/messages`;
      } else {
        topic = `case/${caseId}/channel/${String(config.channel ?? 'progress')}`;
      }
      const seq = await publishLiveMessage(db, topic, { case: { id: caseId, reference: kase.reference }, ...payload });
      return { to, topic, seq, delivered: true };
    });
    return { event: result.delivered === false ? 'failed' : 'done', output: result };
  },
};

export const EVENT_COMPONENTS: EngineComponent[] = [eventWait, poll, livePublish];
