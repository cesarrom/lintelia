import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { caseSignals, cases } from '../entities';
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
    return rows.map((r) => ({
      id: r.id, name: r.name, status: r.status, source: r.source, createdAt: r.createdAt, deliveredAt: r.deliveredAt, fields: Object.keys(r.payload ?? {}),
      ...(options.withHooks && r.status === 'waiting' ? { hookUrl: hookUrl(tenantId, caseId, r.name) } : {}),
    }));
  }
}
