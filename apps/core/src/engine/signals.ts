import { and, asc, eq, sql } from 'drizzle-orm';
import { caseSignals } from '../entities';
import type { TenantDatabase } from '../clients/database.client';
import { timingSafeEqual } from 'node:crypto';
import { internalSignature } from '../auth/internal-signature';
import { env } from '../constants';

/**
 * Message correlation for running cases (docs/plans/12): an external system (a DMV e-lien service, a core system, a
 * vendor without a connector) tells a case that something happened, by name. A `webhook.wait` step waits for one
 * name; a signal that arrives before the step waits is kept and handed over as soon as it does. One lock per case and
 * name serialises the two sides, so none is lost and none is delivered twice.
 */
const lock = (db: TenantDatabase, caseId: string, name: string) => db.execute(sql`select pg_advisory_xact_lock(hashtext(${`${caseId}:${name}`}))`);

/** A step starts waiting: returns a signal that arrived earlier (now delivered), or registers the wait. */
export async function registerWait(db: TenantDatabase, caseId: string, name: string, promise: string) {
  return db.transaction(async (tx) => {
    await lock(tx as unknown as TenantDatabase, caseId, name);
    const [already] = await tx.select().from(caseSignals).where(and(eq(caseSignals.caseId, caseId), eq(caseSignals.promise, promise))).limit(1);
    if (already) return already.status === 'delivered' ? { payload: already.payload ?? {}, source: already.source } : null;
    const [pending] = await tx.select().from(caseSignals)
      .where(and(eq(caseSignals.caseId, caseId), eq(caseSignals.name, name), eq(caseSignals.status, 'pending')))
      .orderBy(asc(caseSignals.createdAt)).limit(1);
    if (pending) {
      await tx.update(caseSignals).set({ status: 'delivered', promise, deliveredAt: new Date() }).where(eq(caseSignals.id, pending.id));
      return { payload: pending.payload ?? {}, source: pending.source };
    }
    await tx.insert(caseSignals).values({ caseId, name, status: 'waiting', promise });
    return null;
  });
}

/** The wait ended without a signal (timeout). */
export async function cancelWait(db: TenantDatabase, caseId: string, name: string, promise: string) {
  await db.transaction(async (tx) => {
    await lock(tx as unknown as TenantDatabase, caseId, name);
    await tx.update(caseSignals).set({ status: 'cancelled' }).where(and(eq(caseSignals.caseId, caseId), eq(caseSignals.promise, promise), eq(caseSignals.status, 'waiting')));
  });
}

/** A signal arrives: for the step waiting on it (its promise is returned, to resolve), or kept until one does. */
export async function deliverSignal(db: TenantDatabase, caseId: string, name: string, payload: Record<string, unknown>, source: string) {
  return db.transaction(async (tx) => {
    await lock(tx as unknown as TenantDatabase, caseId, name);
    const [waiting] = await tx.select().from(caseSignals)
      .where(and(eq(caseSignals.caseId, caseId), eq(caseSignals.name, name), eq(caseSignals.status, 'waiting')))
      .orderBy(asc(caseSignals.createdAt)).limit(1);
    if (waiting) {
      await tx.update(caseSignals).set({ status: 'delivered', payload, source, deliveredAt: new Date() }).where(eq(caseSignals.id, waiting.id));
      return { promise: waiting.promise!, queued: false };
    }
    await tx.insert(caseSignals).values({ caseId, name, status: 'pending', payload, source });
    return { promise: null, queued: true };
  });
}

/** The case's address for a signal: public, authenticated by an HMAC of tenant, case and name (no login needed). */
export function hookToken(tenantId: string, caseId: string, name: string) {
  return internalSignature('case-hook', tenantId, caseId, name).slice(0, 40);
}

export function verifyHookToken(token: string | null | undefined, tenantId: string, caseId: string, name: string) {
  if (!token) return false;
  const expected = Buffer.from(hookToken(tenantId, caseId, name));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const hookUrl = (tenantId: string, caseId: string, name: string) =>
  `${env.HOST.replace(/\/$/, '')}/hooks/cases/${caseId}/${name}?tenant=${tenantId}&token=${hookToken(tenantId, caseId, name)}`;

export const SIGNAL_NAME = /^[a-z][a-z0-9_-]{0,63}$/;
