import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { eventOutbox, webhookDeliveries, webhookSubscriptions, type WebhookAttempt } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { decryptSecret } from '../auth/data-encryption';
import { env } from '../constants';
import { INTERNAL_SIGNATURE_HEADER, internalSignature } from '../auth/internal-signature';
import type { AttemptResult } from './delivery';

export const secretContext = (tenantId: string, subscriptionId: string) => `webhook:${tenantId}:${subscriptionId}`;

/**
 * Persistence of outbound webhooks (outbox, subscriptions, delivery log) used by the durable dispatcher, and the
 * client that hands events to it through the Restate ingress (signed like the case engine's calls).
 */
@Injectable()
export class WebhookStore {
  constructor(@Inject(DATABASES) private readonly databases: Databases) { }

  private db(tenantId: string) {
    return this.databases.forTenant(tenantId);
  }

  // --- handing work to the dispatcher --------------------------------------------------------------------------------

  private async ingress(path: string, body: Record<string, unknown>, signatureParts: string[], idempotencyKey?: string) {
    const response = await fetch(new URL(path, env.RESTATE_ENDPOINT), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', [INTERNAL_SIGNATURE_HEADER]: internalSignature(...signatureParts),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Webhook dispatcher call ${path} failed: ${response.status} ${await response.text()}`);
  }

  /** After the event's transaction committed: fan it out (asynchronously, durably). */
  async dispatch(tenantId: string, eventId: string, onlySubscriptionId?: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.ingress('/webhooks/dispatch/send', { tenantId, eventId, onlySubscriptionId: onlySubscriptionId ?? null }, ['webhook', tenantId, eventId], `dispatch:${eventId}:${onlySubscriptionId ?? '*'}`);
        return;
      } catch (error) {
        if (attempt === 2) console.error(`webhook dispatch of ${eventId} failed`, (error as Error).message);
        else await Bun.sleep(500 * (attempt + 1));
      }
    }
  }

  /** Deliver (again) one delivery; `run` makes each manual resend a new durable execution. */
  deliver(tenantId: string, deliveryId: string, run: string) {
    return this.ingress('/webhooks/deliver/send', { tenantId, deliveryId }, ['webhook', tenantId, deliveryId], `deliver:${deliveryId}:${run}`);
  }

  // --- dispatcher side ---------------------------------------------------------------------------------------------

  async event(tenantId: string, eventId: string) {
    const [row] = await this.db(tenantId).select().from(eventOutbox).where(eq(eventOutbox.id, eventId)).limit(1);
    return row ?? null;
  }

  /** Create one delivery per matching enabled subscription (idempotent per event + subscription). */
  async createDeliveries(tenantId: string, eventId: string, onlySubscriptionId: string | null) {
    const db = this.db(tenantId);
    const event = await this.event(tenantId, eventId);
    if (!event) return [];
    const conditions = [eq(webhookSubscriptions.enabled, true)];
    if (onlySubscriptionId) conditions.push(eq(webhookSubscriptions.id, onlySubscriptionId));
    else conditions.push(sql`${event.type} = any(${webhookSubscriptions.eventTypes})`);
    const subscriptions = await db.select({ id: webhookSubscriptions.id }).from(webhookSubscriptions).where(and(...conditions));
    const ids: string[] = [];
    for (const subscription of subscriptions) {
      const [row] = await db.insert(webhookDeliveries).values({ subscriptionId: subscription.id, eventId, eventType: event.type })
        .onConflictDoNothing().returning({ id: webhookDeliveries.id });
      if (row) ids.push(row.id);
    }
    await db.update(eventOutbox).set({ dispatchedAt: new Date() }).where(eq(eventOutbox.id, eventId));
    return ids;
  }

  /** What one attempt needs: URL, body and the valid signing secrets (decrypted only here). */
  async attemptInput(tenantId: string, deliveryId: string) {
    const db = this.db(tenantId);
    const [row] = await db.select({ delivery: webhookDeliveries, subscription: webhookSubscriptions, event: eventOutbox }).from(webhookDeliveries)
      .innerJoin(webhookSubscriptions, and(eq(webhookSubscriptions.id, webhookDeliveries.subscriptionId), eq(webhookSubscriptions.tenantId, webhookDeliveries.tenantId)))
      .innerJoin(eventOutbox, and(eq(eventOutbox.id, webhookDeliveries.eventId), eq(eventOutbox.tenantId, webhookDeliveries.tenantId)))
      .where(eq(webhookDeliveries.id, deliveryId)).limit(1);
    if (!row || !row.subscription.enabled) return null;
    const context = secretContext(tenantId, row.subscription.id);
    const secrets = [decryptSecret(row.subscription.secretCiphertext, context)];
    if (row.subscription.previousSecretCiphertext && row.subscription.previousSecretExpiresAt && row.subscription.previousSecretExpiresAt > new Date()) {
      secrets.push(decryptSecret(row.subscription.previousSecretCiphertext, context));
    }
    return { url: row.subscription.url, eventId: row.event.id, body: JSON.stringify(row.event.payload), secrets, subscriptionId: row.subscription.id, createdBy: row.subscription.createdByEmail };
  }

  async recordAttempt(tenantId: string, deliveryId: string, result: AttemptResult, next: { status: 'delivered' | 'retrying' | 'failed'; nextAttemptAt: Date | null }) {
    const attempt: WebhookAttempt = { at: new Date().toISOString(), statusCode: result.statusCode, error: result.error, latencyMs: result.latencyMs };
    await this.db(tenantId).update(webhookDeliveries).set({
      status: next.status,
      attempts: sql`${webhookDeliveries.attempts} || ${JSON.stringify([attempt])}::jsonb`,
      attemptCount: sql`${webhookDeliveries.attemptCount} + 1`,
      lastStatusCode: result.statusCode,
      responseExcerpt: result.responseExcerpt,
      nextAttemptAt: next.nextAttemptAt,
      deliveredAt: next.status === 'delivered' ? new Date() : null,
    }).where(eq(webhookDeliveries.id, deliveryId));
  }

  async markSubscriptionHealthy(tenantId: string, subscriptionId: string) {
    await this.db(tenantId).update(webhookSubscriptions).set({ failingSince: null }).where(and(eq(webhookSubscriptions.id, subscriptionId), sql`${webhookSubscriptions.failingSince} is not null`));
  }

  /** A delivery gave up: the subscription is failing; past the window it is disabled. Returns true when disabled now. */
  async markSubscriptionFailing(tenantId: string, subscriptionId: string, reason: string, gone: boolean) {
    const db = this.db(tenantId);
    const [subscription] = await db.select().from(webhookSubscriptions).where(eq(webhookSubscriptions.id, subscriptionId)).limit(1);
    if (!subscription || !subscription.enabled) return false;
    const failingSince = subscription.failingSince ?? new Date();
    const disable = gone || Date.now() - failingSince.getTime() >= env.WEBHOOK_DISABLE_AFTER_SECONDS * 1000;
    await db.update(webhookSubscriptions).set({
      failingSince, ...(disable ? { enabled: false, disabledReason: gone ? 'The receiver answered 410 Gone' : `Failing since ${failingSince.toISOString()}: ${reason}` } : {}),
    }).where(eq(webhookSubscriptions.id, subscriptionId));
    return disable;
  }
}
