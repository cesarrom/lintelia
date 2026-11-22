import * as restate from '@restatedev/restate-sdk/fetch';
import type { Tenant } from '@repo/lintelia/schemas';
import { env } from '../constants';
import { INTERNAL_SIGNATURE_HEADER, verifyInternalSignature } from '../auth/internal-signature';
import type { AuditWriter } from '../services/audit.writer';
import type { Notifier } from '../engine/notifier';
import { attemptDelivery } from './delivery';
import type { WebhookStore } from './webhook-store';

interface Deps {
  store: WebhookStore;
  audit: AuditWriter;
  notifier: Notifier;
  loadTenant(tenantId: string): Promise<Tenant | null>;
}

/**
 * The durable webhook dispatcher (docs/plans/04 §Delivery), a Restate service:
 *  - `dispatch` fans an outbox event out to one delivery per matching subscription;
 *  - `deliver` runs one delivery: attempts with the retry schedule (durable sleeps, so restarts lose nothing), the
 *    delivery log, and disabling subscriptions that keep failing (their creator is e-mailed).
 * Both verify the API's signature: only the API hands work to it.
 */
export function createWebhookRunner({ store, audit, notifier, loadTenant }: Deps) {
  const verify = (ctx: restate.Context, ...parts: string[]) => {
    if (!verifyInternalSignature(ctx.request().headers.get(INTERNAL_SIGNATURE_HEADER), 'webhook', ...parts)) {
      throw new restate.TerminalError('Forbidden', { errorCode: 403 });
    }
  };

  return restate.service({
    name: 'webhooks',
    handlers: {
      dispatch: async (ctx: restate.Context, input: { tenantId: string; eventId: string; onlySubscriptionId?: string | null }) => {
        verify(ctx, input.tenantId, input.eventId);
        const deliveries = await ctx.run('create-deliveries', () => store.createDeliveries(input.tenantId, input.eventId, input.onlySubscriptionId ?? null));
        for (const deliveryId of deliveries) {
          await ctx.run(`start-${deliveryId}`, () => store.deliver(input.tenantId, deliveryId, 'initial'));
        }
        return { deliveries: deliveries.length };
      },

      deliver: async (ctx: restate.Context, input: { tenantId: string; deliveryId: string }) => {
        verify(ctx, input.tenantId, input.deliveryId);
        const { tenantId, deliveryId } = input;
        const schedule = env.WEBHOOK_RETRY_SCHEDULE;
        for (let attempt = 0; attempt <= schedule.length; attempt++) {
          const result = await ctx.run(`attempt-${attempt}`, async () => {
            const target = await store.attemptInput(tenantId, deliveryId);
            if (!target) return { stop: true as const };
            const outcome = await attemptDelivery(target);
            const last = attempt === schedule.length;
            const status = outcome.ok ? 'delivered' : outcome.gone || last ? 'failed' : 'retrying';
            const nextAttemptAt = status === 'retrying' ? new Date(Date.now() + schedule[attempt] * 1000) : null;
            await store.recordAttempt(tenantId, deliveryId, outcome, { status, nextAttemptAt });
            if (outcome.ok) await store.markSubscriptionHealthy(tenantId, target.subscriptionId);
            return { stop: false as const, status, gone: outcome.gone, error: outcome.error, subscriptionId: target.subscriptionId, createdBy: target.createdBy };
          });
          if (result.stop) return { status: 'cancelled' };
          if (result.status === 'delivered') return { status: 'delivered', attempts: attempt + 1 };
          if (result.status === 'failed') {
            await ctx.run('give-up', async () => {
              const disabled = await store.markSubscriptionFailing(tenantId, result.subscriptionId, result.error ?? 'failed', result.gone);
              if (!disabled) return;
              await audit.record(tenantId, { type: 'system' }, 'webhook.disabled', { type: 'webhook', id: result.subscriptionId }, { reason: result.gone ? 'gone' : 'failing' });
              const tenant = await loadTenant(tenantId);
              if (tenant && result.createdBy) {
                await notifier.send(tenant, result.createdBy, 'A webhook was disabled', [
                  'Deliveries to one of your webhook endpoints kept failing, so it was disabled.',
                  `Last error: ${result.error ?? 'unknown'}. Fix the endpoint, then enable the webhook again and resend what it missed.`,
                ]).catch(() => undefined);
              }
            });
            return { status: 'failed', attempts: attempt + 1 };
          }
          await ctx.sleep(schedule[attempt] * 1000);
        }
        return { status: 'failed' };
      },
    },
  });
}
