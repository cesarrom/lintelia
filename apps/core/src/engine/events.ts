import { and, asc, eq, gte, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { caseEvents, caseEventWaits, caseKeys, cases, inboundEvents, FINAL_CASE_STATUSES } from '../entities';
import type { TenantDatabase } from '../clients/database.client';
import { evaluate } from './expressions';

/**
 * Events reaching running cases (docs/plans/17 §3): correlation keys of open cases, `event.wait` registrations, and
 * deliveries — exactly once per case and event. One advisory lock per institution and event type serialises a step
 * starting to wait and an event arriving, so no event falls between the two.
 */
export type InboundEvent = typeof inboundEvents.$inferSelect;
export type EventWait = typeof caseEventWaits.$inferSelect;

/** What a step receives: the event's data, and the event itself. */
export interface DeliveredEvent { id: string; type: string; source: string; data: Record<string, unknown>; receivedAt: string }

export const toDelivered = (event: InboundEvent): DeliveredEvent => ({
  id: event.id, type: event.type, source: event.source, data: event.data ?? {}, receivedAt: new Date(event.receivedAt).toISOString(),
});

const lockType = (db: TenantDatabase, type: string) => db.execute(sql`select pg_advisory_xact_lock(hashtext(${`event:${type}`}))`);

/** Scope of the expressions of a wait (`match`, `filter`) and of start-or-deliver rules: the event. */
export const eventScope = (event: Pick<InboundEvent, 'id' | 'type' | 'source' | 'data'>) => ({ ...(event.data ?? {}), data: event.data ?? {}, type: event.type, source: event.source, event: { id: event.id, type: event.type } });

export const keyValue = (value: unknown) => (value === null || value === undefined || value === '' || typeof value === 'object' ? null : String(value).slice(0, 255));

async function safely<T>(fn: () => Promise<T>, fallback: T) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Does this event satisfy the wait: every key the same value, and the filter? */
export async function waitMatches(wait: Pick<EventWait, 'match' | 'filter'>, event: Pick<InboundEvent, 'id' | 'type' | 'source' | 'data'>) {
  const scope = eventScope(event);
  for (const { expression, value } of Object.values(wait.match ?? {})) {
    const given = await safely(() => evaluate(expression, scope), null);
    if (keyValue(given) !== value) return false;
  }
  if (wait.filter?.trim()) return !!(await safely(() => evaluate(wait.filter!, scope), false));
  return true;
}

// --- correlation keys ---------------------------------------------------------------------------------------------------

/** Set (or change) business keys of an open case; empty values remove the key. */
export async function setCaseKeys(db: TenantDatabase, caseId: string, keys: Record<string, unknown>) {
  for (const [name, raw] of Object.entries(keys)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(name)) continue;
    const value = keyValue(raw);
    if (value === null) {
      await db.delete(caseKeys).where(and(eq(caseKeys.caseId, caseId), eq(caseKeys.name, name)));
      continue;
    }
    await db.insert(caseKeys).values({ caseId, name, value })
      .onConflictDoUpdate({ target: [caseKeys.tenantId, caseKeys.caseId, caseKeys.name], set: { value } });
  }
}

/** Keys of a workflow's `correlation:` computed over the case (`input`, `case`, `steps`). */
export async function computeKeys(correlation: Record<string, string>, vars: Record<string, unknown>) {
  const keys: Record<string, unknown> = {};
  for (const [name, expression] of Object.entries(correlation)) {
    keys[name] = await safely(async () => {
      const text = String(expression);
      if (text.trim().startsWith('=')) return evaluate(text, vars);
      const single = text.match(/^\{\{\s*([^}|]+?)\s*\}\}$/);
      return single ? evaluate(single[1], vars) : text;
    }, null);
  }
  return keys;
}

export const clearCaseKeys = (db: TenantDatabase, caseId: string) => db.delete(caseKeys).where(eq(caseKeys.caseId, caseId));

export async function keysOf(db: TenantDatabase, caseId: string) {
  const rows = await db.select().from(caseKeys).where(eq(caseKeys.caseId, caseId));
  return Object.fromEntries(rows.map((r) => [r.name, r.value]));
}

/** Open cases of a workflow holding every one of these key values. */
export async function openCasesWithKeys(db: TenantDatabase, workflowId: string, keys: Record<string, string>) {
  const entries = Object.entries(keys);
  if (!entries.length) return [];
  let candidates: string[] | null = null;
  for (const [name, value] of entries) {
    const rows = await db.select({ caseId: caseKeys.caseId }).from(caseKeys).where(and(eq(caseKeys.name, name), eq(caseKeys.value, value)));
    const ids = rows.map((r) => r.caseId);
    candidates = candidates === null ? ids : candidates.filter((id) => ids.includes(id));
    if (!candidates.length) return [];
  }
  return db.select().from(cases).where(and(inArray(cases.id, candidates!), eq(cases.workflowId, workflowId), notInArray(cases.status, [...FINAL_CASE_STATUSES, 'draft'])))
    .orderBy(asc(cases.createdAt));
}

// --- waiting ---------------------------------------------------------------------------------------------------------

export interface WaitRequest {
  caseId: string;
  stepId: string;
  promise: string;
  eventType: string;
  match: Record<string, { expression: string; value: string }>;
  filter: string | null;
  consume: boolean;
  /** Events received up to this long before the step waits count too (0: only those after). */
  bufferMs: number;
}

/**
 * A step starts waiting: an event already handed to the case (start-or-deliver), or a recent one within the buffer,
 * is delivered at once; otherwise the wait is registered for the router. Idempotent on the promise (retries).
 */
export async function registerEventWait(db: TenantDatabase, request: WaitRequest): Promise<DeliveredEvent | null> {
  return db.transaction(async (txx) => {
    const tx = txx as unknown as TenantDatabase;
    await lockType(tx, request.eventType);
    const [existing] = await tx.select().from(caseEventWaits).where(and(eq(caseEventWaits.caseId, request.caseId), eq(caseEventWaits.promise, request.promise))).limit(1);
    if (existing) {
      if (existing.status !== 'delivered' || !existing.eventId) return null;
      const [event] = await tx.select().from(inboundEvents).where(eq(inboundEvents.id, existing.eventId)).limit(1);
      return event ? toDelivered(event) : null;
    }
    const take = async (event: InboundEvent) => {
      const [wait] = await tx.insert(caseEventWaits).values({
        caseId: request.caseId, stepId: request.stepId, promise: request.promise, eventType: request.eventType, match: request.match,
        filter: request.filter, consume: request.consume, status: 'delivered', eventId: event.id, deliveredAt: new Date(),
      }).returning();
      await tx.insert(caseEvents).values({ caseId: request.caseId, eventId: event.id, eventType: event.type, status: 'delivered', waitId: wait.id, deliveredAt: new Date() })
        .onConflictDoUpdate({ target: [caseEvents.tenantId, caseEvents.caseId, caseEvents.eventId], set: { status: 'delivered', waitId: wait.id, deliveredAt: new Date() } });
      if (request.consume) await tx.update(inboundEvents).set({ consumedBy: request.caseId }).where(eq(inboundEvents.id, event.id));
      await tx.update(inboundEvents).set({ deliveredTo: sql`${inboundEvents.deliveredTo} || ${JSON.stringify([request.caseId])}::jsonb` }).where(eq(inboundEvents.id, event.id));
      return toDelivered(event);
    };
    // Handed to this case earlier (it was busy): oldest first.
    const pending = await tx.select({ event: inboundEvents }).from(caseEvents)
      .innerJoin(inboundEvents, and(eq(inboundEvents.id, caseEvents.eventId), eq(inboundEvents.tenantId, caseEvents.tenantId)))
      .where(and(eq(caseEvents.caseId, request.caseId), eq(caseEvents.eventType, request.eventType), eq(caseEvents.status, 'pending')))
      .orderBy(asc(inboundEvents.receivedAt));
    for (const { event } of pending) if (await waitMatches(request, event)) return take(event);
    // Arrived a moment before the step waited.
    if (request.bufferMs > 0) {
      const recent = await tx.select().from(inboundEvents).where(and(
        eq(inboundEvents.type, request.eventType), gte(inboundEvents.receivedAt, new Date(Date.now() - request.bufferMs)),
        request.consume ? isNull(inboundEvents.consumedBy) : undefined,
        sql`not exists (select 1 from ${caseEvents} where ${caseEvents.caseId} = ${request.caseId} and ${caseEvents.eventId} = ${inboundEvents.id})`,
      )).orderBy(asc(inboundEvents.receivedAt)).limit(200);
      for (const event of recent) {
        if (event.consumedBy) continue;
        if (await waitMatches(request, event)) return take(event);
      }
    }
    await tx.insert(caseEventWaits).values({
      caseId: request.caseId, stepId: request.stepId, promise: request.promise, eventType: request.eventType, match: request.match,
      filter: request.filter, consume: request.consume, status: 'waiting',
    });
    return null;
  });
}

/** The wait timed out: cancelled — unless an event was delivered in the meantime (then it is returned). */
export async function cancelEventWait(db: TenantDatabase, caseId: string, promise: string, eventType: string): Promise<DeliveredEvent | null> {
  return db.transaction(async (txx) => {
    const tx = txx as unknown as TenantDatabase;
    await lockType(tx, eventType);
    const [wait] = await tx.select().from(caseEventWaits).where(and(eq(caseEventWaits.caseId, caseId), eq(caseEventWaits.promise, promise))).limit(1);
    if (wait?.status === 'delivered' && wait.eventId) {
      const [event] = await tx.select().from(inboundEvents).where(eq(inboundEvents.id, wait.eventId)).limit(1);
      return event ? toDelivered(event) : null;
    }
    if (wait) await tx.update(caseEventWaits).set({ status: 'cancelled' }).where(eq(caseEventWaits.id, wait.id));
    return null;
  });
}

export interface Delivery { caseId: string; promise: string; event: DeliveredEvent }

/**
 * A new event: delivered to every waiting step it matches (broadcast), or to the oldest matching `consume` wait only
 * (work queue) — never twice to a case. Returns the promises to resolve once committed.
 */
export async function deliverToWaits(db: TenantDatabase, event: InboundEvent): Promise<Delivery[]> {
  return db.transaction(async (txx) => {
    const tx = txx as unknown as TenantDatabase;
    await lockType(tx, event.type);
    const waits = await tx.select().from(caseEventWaits).where(and(eq(caseEventWaits.eventType, event.type), eq(caseEventWaits.status, 'waiting'))).orderBy(asc(caseEventWaits.createdAt));
    const deliveries: Delivery[] = [];
    let consumed = !!event.consumedBy;
    const seen = new Set<string>();
    for (const wait of waits) {
      if (seen.has(wait.caseId)) continue;
      if (wait.consume && consumed) continue;
      if (!(await waitMatches(wait, event))) continue;
      const [row] = await tx.insert(caseEvents).values({ caseId: wait.caseId, eventId: event.id, eventType: event.type, status: 'delivered', waitId: wait.id, deliveredAt: new Date() })
        .onConflictDoNothing().returning();
      if (!row) continue;
      seen.add(wait.caseId);
      await tx.update(caseEventWaits).set({ status: 'delivered', eventId: event.id, deliveredAt: new Date() }).where(eq(caseEventWaits.id, wait.id));
      if (wait.consume) {
        consumed = true;
        await tx.update(inboundEvents).set({ consumedBy: wait.caseId }).where(eq(inboundEvents.id, event.id));
      }
      deliveries.push({ caseId: wait.caseId, promise: wait.promise, event: toDelivered(event) });
    }
    return deliveries;
  });
}

/**
 * Hand an event to one case (start-or-deliver): to its waiting step when it matches, else kept for the case until one
 * of its steps waits for this type. Null when the case already had it.
 */
export async function handToCase(db: TenantDatabase, caseId: string, event: InboundEvent): Promise<{ delivery: Delivery | null; kept: boolean } | null> {
  return db.transaction(async (txx) => {
    const tx = txx as unknown as TenantDatabase;
    await lockType(tx, event.type);
    const [row] = await tx.insert(caseEvents).values({ caseId, eventId: event.id, eventType: event.type, status: 'pending' }).onConflictDoNothing().returning();
    if (!row) return null;
    const waits = await tx.select().from(caseEventWaits).where(and(eq(caseEventWaits.caseId, caseId), eq(caseEventWaits.eventType, event.type), eq(caseEventWaits.status, 'waiting'))).orderBy(asc(caseEventWaits.createdAt));
    for (const wait of waits) {
      if (!(await waitMatches(wait, event))) continue;
      await tx.update(caseEvents).set({ status: 'delivered', waitId: wait.id, deliveredAt: new Date() }).where(eq(caseEvents.id, row.id));
      await tx.update(caseEventWaits).set({ status: 'delivered', eventId: event.id, deliveredAt: new Date() }).where(eq(caseEventWaits.id, wait.id));
      return { delivery: { caseId, promise: wait.promise, event: toDelivered(event) }, kept: false };
    }
    return { delivery: null, kept: true };
  });
}
