import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { auditEvents, cases, eventOutbox, tenants, webhookSubscriptions } from '../entities';
import { eventForAudit, newEventId } from '../webhooks/events';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';

export interface AuditActor {
  /** member | client | staff | workflow | api | public | system */
  type: string;
  id?: string | null;
  email?: string | null;
}

export interface AuditTarget {
  type: string;
  id?: string | null;
  [key: string]: unknown;
}

/**
 * Writes the append-only, hash-chained audit trail of a tenant. Entries are numbered per tenant; each stores the
 * hash of the previous one, so deleting or altering an entry breaks the chain (the application role cannot UPDATE or
 * DELETE audit rows at all). A transaction-scoped advisory lock serialises writers of the same tenant.
 */
type EventSink = (tenantId: string, eventId: string) => Promise<void> | void;
let eventSink: EventSink | null = null;

/** Where committed webhook events go (the webhook dispatcher registers itself at startup). */
export const setEventSink = (sink: EventSink | null) => { eventSink = sink; };

@Injectable()
export class AuditWriter {
  constructor(@Inject(DATABASES) private readonly databases: Databases) { }

  async record(tenantId: string, actor: AuditActor, action: string, target?: AuditTarget | null, details: Record<string, unknown> = {}, caseId?: string | null) {
    const db = this.databases.forTenant(tenantId);
    const pendingEvents: string[] = [];
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${tenantId}, 0))`);
      const [last] = await tx.select({ seq: auditEvents.seq, hash: auditEvents.hash }).from(auditEvents).orderBy(desc(auditEvents.seq)).limit(1);
      const seq = (last?.seq ?? 0) + 1;
      const at = new Date();
      const { type: targetType, id: targetId, ...targetRest } = target ?? { type: null, id: null };
      const allDetails = { ...targetRest, ...details };
      const previousHash = last?.hash ?? null;
      const hash = createHash('sha256').update(JSON.stringify({
        tenantId, seq, at: at.toISOString(), actor: { type: actor.type, id: actor.id ?? null, email: actor.email ?? null },
        action, targetType, targetId: targetId ?? null, caseId: caseId ?? null, details: allDetails, previousHash,
      })).digest('hex');
      const [row] = await tx.insert(auditEvents).values({
        seq, at, actorType: actor.type, actorId: actor.id ?? null, actorEmail: actor.email ?? null, action,
        targetType: targetType ?? null, targetId: targetId ?? null, caseId: caseId ?? null, details: allDetails, previousHash, hash,
      }).returning();

      // Outbound webhooks: changes that institutions subscribe to are written to the outbox in the same transaction as
      // their audit entry (docs/plans/04 §Delivery), only when someone subscribes to that event type.
      const event = eventForAudit(action, target, allDetails, caseId);
      if (event) {
        const [subscribed] = await tx.select({ one: sql`1` }).from(webhookSubscriptions)
          .where(and(eq(webhookSubscriptions.enabled, true), sql`${event.type} = any(${webhookSubscriptions.eventTypes})`)).limit(1);
        if (subscribed) {
          let data = event.data;
          if (event.caseId) {
            const [kase] = await tx.select().from(cases).where(eq(cases.id, event.caseId)).limit(1);
            if (kase) {
              data = {
                caseId: kase.id, reference: kase.reference, workflow: { id: kase.workflowId, version: kase.workflowVersion },
                status: kase.status, outcome: kase.outcome ?? null, ...data,
              };
            }
          }
          const [tenant] = await tx.select({ domain: tenants.domain }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
          const id = newEventId();
          await tx.insert(eventOutbox).values({ id, type: event.type, payload: { id, type: event.type, time: at.toISOString(), tenant: tenant?.domain ?? tenantId, data } });
          pendingEvents.push(id);
        }
      }
      return row;
    }).then((row) => {
      for (const id of pendingEvents.splice(0)) void Promise.resolve(eventSink?.(tenantId, id)).catch(() => undefined);
      return row;
    });
  }

  async list(tenantId: string, filter: { caseId?: string; action?: string; actorType?: string; from?: Date; to?: Date; order?: 'asc' | 'desc'; limit?: number } = {}) {
    const conditions: SQL[] = [];
    if (filter.caseId) conditions.push(eq(auditEvents.caseId, filter.caseId));
    if (filter.action) conditions.push(eq(auditEvents.action, filter.action));
    if (filter.actorType) conditions.push(eq(auditEvents.actorType, filter.actorType));
    if (filter.from) conditions.push(gte(auditEvents.at, filter.from));
    if (filter.to) conditions.push(lte(auditEvents.at, filter.to));
    const rows = await this.databases.forTenant(tenantId).select().from(auditEvents)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(filter.order === 'asc' ? asc(auditEvents.seq) : desc(auditEvents.seq))
      .limit(Math.min(filter.limit ?? 500, 5000));
    return rows.map(toAuditEntry);
  }
}

export const toAuditEntry = (row: typeof auditEvents.$inferSelect) => ({
  id: row.id,
  seq: row.seq,
  at: row.at.toISOString(),
  actor: { type: row.actorType, id: row.actorId, email: row.actorEmail },
  action: row.action,
  target: { type: row.targetType, id: row.targetId, ...(row.details as Record<string, unknown>) },
  caseId: row.caseId,
  details: row.details,
  hash: row.hash,
  previousHash: row.previousHash,
});
