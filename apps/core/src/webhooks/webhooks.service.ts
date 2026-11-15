import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { eventOutbox, webhookDeliveries, webhookSubscriptions } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { AuditWriter } from '../services/audit.writer';
import { encryptSecret } from '../auth/data-encryption';
import { BadRequestError, NotFoundError } from '../http/errors';
import { assertDeliverableUrl } from './delivery';
import { newEventId, WEBHOOK_EVENT_NAMES, WEBHOOK_EVENT_TYPES } from './events';
import { secretContext, WebhookStore } from './webhook-store';

const newSigningSecret = () => `whsec_${randomBytes(24).toString('base64')}`;
const ROTATION_OVERLAP_MS = 24 * 3600_000;

const present = (row: typeof webhookSubscriptions.$inferSelect) => ({
  id: row.id, url: row.url, description: row.description, eventTypes: row.eventTypes, enabled: row.enabled,
  failingSince: row.failingSince, disabledReason: row.disabledReason, rotatingUntil: row.previousSecretExpiresAt && row.previousSecretExpiresAt > new Date() ? row.previousSecretExpiresAt : null,
  createdBy: row.createdByEmail, createdAt: row.createdAt, updatedAt: row.updatedAt,
});

const presentDelivery = (row: typeof webhookDeliveries.$inferSelect) => ({
  id: row.id, subscriptionId: row.subscriptionId, eventId: row.eventId, eventType: row.eventType, status: row.status,
  attempts: row.attempts, attemptCount: row.attemptCount, lastStatusCode: row.lastStatusCode, responseExcerpt: row.responseExcerpt,
  nextAttemptAt: row.nextAttemptAt, deliveredAt: row.deliveredAt, createdAt: row.createdAt,
});

/** Webhook subscriptions of the institution and their delivery log (docs/plans/04). */
@Injectable({ scope: Scope.REQUEST })
export class WebhooksService {
  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(WebhookStore) private readonly store: WebhookStore,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private get db() {
    return this.databases.forTenant(this.tenant.id);
  }

  private get actor() {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  eventTypes() {
    return WEBHOOK_EVENT_TYPES.filter((e) => e.type !== 'webhook.test');
  }

  private validEventTypes(types: unknown) {
    if (!Array.isArray(types) || !types.length) throw new BadRequestError('Choose at least one event');
    const unknown = types.filter((t) => !WEBHOOK_EVENT_NAMES.has(t) || t === 'webhook.test');
    if (unknown.length) throw new BadRequestError(`Unknown events: ${unknown.join(', ')}`);
    return [...new Set(types as string[])];
  }

  private async validUrl(url: unknown) {
    if (typeof url !== 'string' || !url.trim()) throw new BadRequestError('A URL is required');
    try {
      return (await assertDeliverableUrl(url.trim())).toString();
    } catch (error) {
      throw new BadRequestError((error as Error).message);
    }
  }

  async list() {
    return (await this.db.select().from(webhookSubscriptions).orderBy(desc(webhookSubscriptions.createdAt))).map(present);
  }

  private async load(id: string) {
    const [row] = await this.db.select().from(webhookSubscriptions).where(eq(webhookSubscriptions.id, id)).limit(1);
    if (!row) throw new NotFoundError('Webhook not found');
    return row;
  }

  async get(id: string) {
    return present(await this.load(id));
  }

  /** `{ url, description?, eventTypes[] (or events[]) }` → the subscription and its signing secret (shown once). */
  async create(input: { url?: string; description?: string; eventTypes?: string[]; events?: string[] }) {
    const url = await this.validUrl(input.url);
    const eventTypes = this.validEventTypes(input.eventTypes ?? input.events);
    const secret = newSigningSecret();
    const [row] = await this.db.transaction(async (tx) => {
      const [created] = await tx.insert(webhookSubscriptions).values({ url, description: input.description ?? null, eventTypes, secretCiphertext: 'pending', createdByEmail: this.user.email }).returning();
      return tx.update(webhookSubscriptions).set({ secretCiphertext: encryptSecret(secret, secretContext(this.tenant.id, created.id)) }).where(eq(webhookSubscriptions.id, created.id)).returning();
    });
    await this.audit.record(this.tenant.id, this.actor, 'webhook.created', { type: 'webhook', id: row.id }, { url, eventTypes });
    return { ...present(row), secret };
  }

  async update(id: string, input: { url?: string; description?: string | null; eventTypes?: string[]; events?: string[]; enabled?: boolean }) {
    const row = await this.load(id);
    const changes: Partial<typeof webhookSubscriptions.$inferInsert> = {};
    if (input.url !== undefined) changes.url = await this.validUrl(input.url);
    if (input.description !== undefined) changes.description = input.description;
    if (input.eventTypes !== undefined || input.events !== undefined) changes.eventTypes = this.validEventTypes(input.eventTypes ?? input.events);
    if (input.enabled !== undefined) {
      changes.enabled = Boolean(input.enabled);
      if (changes.enabled) { changes.failingSince = null; changes.disabledReason = null; }
    }
    const [updated] = await this.db.update(webhookSubscriptions).set(changes).where(eq(webhookSubscriptions.id, row.id)).returning();
    await this.audit.record(this.tenant.id, this.actor, 'webhook.updated', { type: 'webhook', id: row.id }, { fields: Object.keys(changes) });
    return present(updated);
  }

  async remove(id: string) {
    const row = await this.load(id);
    await this.db.delete(webhookSubscriptions).where(eq(webhookSubscriptions.id, row.id));
    await this.audit.record(this.tenant.id, this.actor, 'webhook.deleted', { type: 'webhook', id: row.id }, { url: row.url });
  }

  /** A new secret; the previous one also signs for 24 hours (two signatures in the header) so receivers can switch. */
  async rotateSecret(id: string) {
    const row = await this.load(id);
    const secret = newSigningSecret();
    const [updated] = await this.db.update(webhookSubscriptions).set({
      secretCiphertext: encryptSecret(secret, secretContext(this.tenant.id, row.id)),
      previousSecretCiphertext: row.secretCiphertext,
      previousSecretExpiresAt: new Date(Date.now() + ROTATION_OVERLAP_MS),
    }).where(eq(webhookSubscriptions.id, row.id)).returning();
    await this.audit.record(this.tenant.id, this.actor, 'webhook.secret_rotated', { type: 'webhook', id: row.id });
    return { ...present(updated), secret };
  }

  /** Send a `webhook.test` event to this subscription only. */
  async test(id: string) {
    const row = await this.load(id);
    const eventId = newEventId();
    await this.db.insert(eventOutbox).values({
      id: eventId, type: 'webhook.test',
      payload: { id: eventId, type: 'webhook.test', time: new Date().toISOString(), tenant: this.tenant.domain, data: { message: 'Hello from Fintivio', subscriptionId: row.id } },
    });
    await this.store.dispatch(this.tenant.id, eventId, row.id);
    return { eventId };
  }

  async deliveries(id: string, limit = 100) {
    await this.load(id);
    const rows = await this.db.select().from(webhookDeliveries).where(eq(webhookDeliveries.subscriptionId, id))
      .orderBy(desc(webhookDeliveries.createdAt)).limit(Math.min(limit, 500));
    return rows.map(presentDelivery);
  }

  async resend(deliveryId: string) {
    const [row] = await this.db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, deliveryId)).limit(1);
    if (!row) throw new NotFoundError('Delivery not found');
    const subscription = await this.load(row.subscriptionId);
    if (!subscription.enabled) throw new BadRequestError('Enable the webhook before resending');
    await this.db.update(webhookDeliveries).set({ status: 'pending', nextAttemptAt: null }).where(and(eq(webhookDeliveries.id, row.id)));
    await this.store.deliver(this.tenant.id, row.id, `resend-${Date.now()}`);
    await this.audit.record(this.tenant.id, this.actor, 'webhook.delivery_resent', { type: 'webhook', id: subscription.id }, { deliveryId: row.id, eventId: row.eventId });
    return presentDelivery({ ...row, status: 'pending' });
  }
}
