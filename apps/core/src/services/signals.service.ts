import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { caseEvents, caseEventWaits, caseKeys, caseSignals, cases, inboundEvents } from '../entities';
import { CASE_REPOSITORY, ENGINE_CLIENT, EngineClient } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { isFinalStatus } from '../engine/case-repository';
import { deliverSignal, hookUrl, SIGNAL_NAME, verifyHookToken } from '../engine/signals';
import { AuditWriter, type AuditActor } from './audit.writer';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../http/errors';

const MAX_PAYLOAD = 64_000;

/**
 * Signals for running cases (docs/plans/12): from the institution's systems through the API (`cases:signal`), or from
 * any system through the case's signed hook URL. A `webhook.wait` step receives them (early ones are kept).
 */
@Injectable()
export class SignalsService {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(ENGINE_CLIENT) private readonly engine: EngineClient,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  async deliver(tenantId: string, caseId: string, name: string, payload: unknown, actor: AuditActor, source: string) {
    if (!SIGNAL_NAME.test(name)) throw new BadRequestError('Signal names are lower-case letters, digits, - and _');
    const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : { value: payload ?? null };
    if (JSON.stringify(body).length > MAX_PAYLOAD) throw new BadRequestError('A signal is limited to 64 kB');
    const kase = await this.repository.getCase(tenantId, caseId);
    if (!kase) throw new NotFoundError('Case not found');
    if (isFinalStatus(kase.status)) throw new ConflictError(`The case is ${kase.status}`);
    const result = await deliverSignal(this.repository.db(tenantId), caseId, name, body, source);
    if (result.promise) await this.engine.resolve(tenantId, caseId, result.promise, { outcome: 'received', output: body, by: { type: source } });
    await this.audit.record(tenantId, actor, 'case.signal_received', { type: 'case', id: caseId, reference: kase.reference }, { name, source, queued: result.queued, fields: Object.keys(body).slice(0, 20) }, caseId);
    return { case: kase.reference, name, delivered: !result.queued, queued: result.queued };
  }

  /** From the case's signed URL (`{{case.hooks.<name>}}`): no account, the token proves the address was given out. */
  async deliverFromHook(tenantId: string | null, caseId: string, name: string, token: string | null, payload: unknown) {
    if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId) || !/^[0-9a-f-]{36}$/i.test(caseId) || !verifyHookToken(token, tenantId, caseId, name)) {
      throw new ForbiddenError('This address is not valid');
    }
    return this.deliver(tenantId, caseId, name, payload, { type: 'system', email: 'hook' }, 'hook');
  }

  /**
   * What a case waits for and what it received (the case page). The hook URL of a waiting signal is a capability (it
   * delivers the signal): only shown to whoever may signal anyway (`cases:signal`), to hand it to the other system.
   */
  async list(tenantId: string, caseId: string, options: { withHooks?: boolean } = {}) {
    const db = this.repository.db(tenantId);
    const [kase] = await db.select({ id: cases.id }).from(cases).where(eq(cases.id, caseId)).limit(1);
    if (!kase) throw new NotFoundError('Case not found');
    const rows = await db.select().from(caseSignals).where(and(eq(caseSignals.caseId, caseId))).orderBy(desc(caseSignals.createdAt)).limit(50);
    const signals = rows.map((r) => ({
      id: r.id, kind: 'signal' as const, name: r.name, status: r.status, source: r.source, createdAt: r.createdAt, deliveredAt: r.deliveredAt, fields: Object.keys(r.payload ?? {}),
      ...(options.withHooks && r.status === 'waiting' ? { hookUrl: hookUrl(tenantId, caseId, r.name) } : {}),
    }));
    // Events about the case (docs/plans/17): what its steps wait for, by business key, and events handed to it early.
    const waits = await db.select({ wait: caseEventWaits, event: inboundEvents }).from(caseEventWaits)
      .leftJoin(inboundEvents, and(eq(inboundEvents.id, caseEventWaits.eventId), eq(inboundEvents.tenantId, caseEventWaits.tenantId)))
      .where(eq(caseEventWaits.caseId, caseId)).orderBy(desc(caseEventWaits.createdAt)).limit(50);
    const pending = await db.select({ row: caseEvents, event: inboundEvents }).from(caseEvents)
      .innerJoin(inboundEvents, and(eq(inboundEvents.id, caseEvents.eventId), eq(inboundEvents.tenantId, caseEvents.tenantId)))
      .where(and(eq(caseEvents.caseId, caseId), eq(caseEvents.status, 'pending'))).limit(50);
    const events = [
      ...waits.map(({ wait, event }) => ({
        id: wait.id, kind: 'event' as const, name: wait.eventType, status: wait.status, source: event?.source ?? null, createdAt: wait.createdAt, deliveredAt: wait.deliveredAt,
        fields: Object.keys(event?.data ?? {}), keys: Object.fromEntries(Object.entries(wait.match ?? {}).map(([k, v]) => [k, v.value])),
      })),
      ...pending.map(({ row, event }) => ({
        id: row.id, kind: 'event' as const, name: row.eventType, status: 'pending' as const, source: event.source, createdAt: row.createdAt, deliveredAt: null, fields: Object.keys(event.data ?? {}), keys: {},
      })),
    ];
    const keys = await db.select({ name: caseKeys.name, value: caseKeys.value }).from(caseKeys).where(eq(caseKeys.caseId, caseId));
    return [...signals, ...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((item) => ({ ...item, ...(item.kind === 'event' && !Object.keys((item as { keys?: object }).keys ?? {}).length ? { keys: Object.fromEntries(keys.map((k) => [k.name, k.value])) } : {}) }));
  }
}
