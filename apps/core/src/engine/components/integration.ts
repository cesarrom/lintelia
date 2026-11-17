import * as restate from '@restatedev/restate-sdk/fetch';
import { durationMs } from '../durations';
import { cancelWait, registerWait, SIGNAL_NAME } from '../signals';
import { WORKFLOW_ACTOR, type EngineComponent, type TaskSignal } from './types';

/**
 * Waiting for the outside world (docs/plans/12): the case pauses until an external system signals it by name — its
 * own address (`{{case.hooks.<name>}}`, a signed URL to give to that system, e.g. in an HTTP step before) or the API
 * (`POST /cases/:id/signals/:name`). The signal's body becomes the step's result. Signals that arrive early are kept.
 */
const webhookWait: EngineComponent = {
  definition: {
    type: 'webhook.wait', version: 1, title: 'Wait for a signal', description: 'Pauses until an external system calls the case back (its hook URL or the API), with an optional time limit.',
    icon: 'Webhook', category: 'flow', kind: 'timer', source: { kind: 'builtin' },
    configSchema: {
      type: 'object', required: ['name'],
      properties: {
        name: { type: 'string', title: 'Signal name', description: 'lower-case, e.g. title_received; its URL is {{case.hooks.<name>}}', pattern: '^[a-z][a-z0-9_-]{0,63}$' },
        timeout: { type: 'string', title: 'Give up after', description: 'ISO-8601 duration, e.g. P30D (empty: wait forever)', 'x-widget': 'duration' },
      },
    },
    defaults: { name: 'callback', timeout: 'P7D' },
    summary: 'Waits for {{name}}',
    events: { static: ['received', 'timeout'] },
  },
  resolveConfig: false,
  validate: (config) => (SIGNAL_NAME.test(String(config.name ?? '')) ? [] : ['needs a signal name (lower-case letters, digits, - and _)']),
  async execute({ ctx, label, config, tenantId, caseId, deps }) {
    const name = String(config.name);
    const promise = `hook:${name}:${label}`.slice(0, 150);
    let signal = await ctx.run(`hook-wait-${label}`, async () => {
      const early = await registerWait(deps.repository.db(tenantId), caseId, name, promise);
      if (!early) await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'case.waiting_for_signal', { type: 'case', id: caseId }, { name, timeout: config.timeout ?? null }, caseId);
      return early;
    });
    if (!signal) {
      const timeout = durationMs(config.timeout);
      try {
        const received = timeout ? await ctx.promise<TaskSignal>(promise).get().orTimeout(timeout) : await ctx.promise<TaskSignal>(promise).get();
        signal = { payload: received.output ?? {}, source: received.by?.type ?? null };
      } catch (error) {
        if (!(error instanceof restate.TimeoutError)) throw error;
        await ctx.run(`hook-timeout-${label}`, async () => {
          await cancelWait(deps.repository.db(tenantId), caseId, name, promise);
          await deps.audit.record(tenantId, WORKFLOW_ACTOR, 'case.signal_timed_out', { type: 'case', id: caseId }, { name }, caseId);
        });
        return { event: 'timeout', output: { name, timedOut: true } };
      }
    }
    return { event: 'received', output: { ...(signal.payload as Record<string, unknown>), signal: { name, source: signal.source } } };
  },
};

export const INTEGRATION_COMPONENTS: EngineComponent[] = [webhookWait];
