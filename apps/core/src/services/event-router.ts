import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, arrayContains, eq, lt, sql } from 'drizzle-orm';
import { caseEvents, inboundEvents, workflowVersions } from '../entities';
import { CASE_REPOSITORY, ENGINE_CLIENT, type EngineClient } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { parseDefinition, renderCaseTitle } from '../engine/definition';
import { interpolate } from '../engine/expressions';
import { deliverToWaits, eventScope, handToCase, keyValue, openCasesWithKeys, type Delivery, type InboundEvent } from '../engine/events';
import { evaluate } from '../engine/expressions';
import { AuditWriter, type AuditActor } from './audit.writer';
import { DATABASES } from '../injector/tokens/databases.token';
import type { Databases } from '../clients/database.client';

export interface IncomingEvent {
  /** `api:<type>`, `connector:<id>/<type>`, or a platform event (`client.flagged`). */
  type: string;
  data: Record<string, unknown>;
  /** Who sent it (`api:<client id>`, `connector:<id>`, `platform`). */
  source: string;
  /** The sender's id of the event: the same id twice is one event (7 days). */
  dedupeKey?: string | null;
  applicant?: { id?: string | null; email?: string | null; name?: string | null } | null;
  /** Recorded as who started the cases the event starts. */
  actor: AuditActor;
}

export interface RoutedEvent {
  duplicate: boolean;
  eventId: string | null;
  /** Cases the event was handed to (waiting for it, or start-or-deliver). */
  delivered: Array<{ id: string; reference: string; waiting: boolean }>;
  started: Array<{ id: string; reference: string }>;
}

const RETENTION_DAYS = 7;

/**
 * One router for every incoming event (docs/plans/17 §3.4): kept (deduplicated by the sender's id), then
 *  1. delivered to the open cases waiting for it (`event.wait`: type, business keys, filter; all of them, or the first
 *     of those that `consume` it),
 *  2. handed to the open case of each workflow that starts-or-receives it (`startOn: [{ event, correlate }]`) — a case
 *     starts when none holds those keys,
 *  3. starting the workflows that list it in `startOn`.
 * A case never gets an event twice; an event a case is not ready for is kept for it (start-or-deliver) or for the
 * steps that accept events received a moment before they wait (`buffer`).
 */
@Injectable()
export class EventRouter implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(ENGINE_CLIENT) private readonly engine: EngineClient,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(DATABASES) private readonly databases: Databases,
  ) { }

  onModuleInit() {
    this.timer = setInterval(() => void this.prune().catch((error) => console.error('event retention failed', (error as Error).message)), 3600_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async route(tenantId: string, input: IncomingEvent): Promise<RoutedEvent> {
    const db = this.repository.db(tenantId);
    const [event] = await db.insert(inboundEvents).values({
      type: input.type, source: input.source, dedupeKey: input.dedupeKey ?? null, data: input.data ?? {}, applicant: input.applicant ?? null,
    }).onConflictDoNothing().returning();
    if (!event) return { duplicate: true, eventId: null, delivered: [], started: [] };

    const delivered: RoutedEvent['delivered'] = [];
    const resolveAll = async (deliveries: Delivery[]) => {
      for (const delivery of deliveries) {
        await this.engine.resolve(tenantId, delivery.caseId, delivery.promise, { outcome: 'received', output: delivery.event as unknown as Record<string, unknown>, by: { type: input.source } })
          .catch((error) => console.error(`event ${event.id} to case ${delivery.caseId}: ${(error as Error).message}`));
      }
    };

    // 1. Cases waiting for it.
    const deliveries = await deliverToWaits(db, event);
    await resolveAll(deliveries);
    for (const d of deliveries) delivered.push({ id: d.caseId, reference: (await this.repository.getCase(tenantId, d.caseId))?.reference ?? '', waiting: true });

    // 2 and 3. Workflows it starts — or whose open case it goes to.
    const started: RoutedEvent['started'] = [];
    const versions = await db.select().from(workflowVersions).where(and(eq(workflowVersions.status, 'active'), arrayContains(workflowVersions.startOn, [input.type])));
    for (const version of versions) {
      const definition = parseDefinition(version.yaml);
      const rule = definition.startRules.find((r) => r.event === input.type);
      if (rule?.correlate) {
        const keys: Record<string, string> = {};
        for (const [name, expression] of Object.entries(rule.correlate)) {
          const value = keyValue(await evaluate(expression, eventScope(event)).catch(() => null));
          if (value !== null) keys[name] = value;
        }
        if (Object.keys(keys).length === Object.keys(rule.correlate).length) {
          const [open] = await openCasesWithKeys(db, version.workflowId, keys);
          if (open) {
            const handed = await handToCase(db, open.id, event);
            if (handed) {
              if (handed.delivery) await resolveAll([handed.delivery]);
              if (!delivered.some((d) => d.id === open.id)) delivered.push({ id: open.id, reference: open.reference, waiting: !!handed.delivery });
              await this.audit.record(tenantId, input.actor, 'case.event_handed', { type: 'case', id: open.id, reference: open.reference }, { event: input.type, eventId: event.id, keys, kept: handed.kept }, open.id);
            }
            continue;
          }
        }
      }
      started.push(await this.startCase(tenantId, version, definition, event, input));
    }

    await db.update(inboundEvents).set({ deliveredTo: delivered.map((d) => d.id), startedCases: started.map((s) => s.id) }).where(eq(inboundEvents.id, event.id));
    return { duplicate: false, eventId: event.id, delivered, started };
  }

  private async startCase(tenantId: string, version: typeof workflowVersions.$inferSelect, definition: ReturnType<typeof parseDefinition>, event: InboundEvent, input: IncomingEvent) {
    const applicant = input.applicant ?? null;
    const kase = await this.repository.createCase(tenantId, {
      title: renderCaseTitle(version.yaml, event.data, applicant?.name || applicant?.email || String((event.data as Record<string, unknown>).subject ?? '') || input.type, interpolate),
      workflowId: version.workflowId, workflowVersion: version.version, status: 'submitted',
      applicantId: applicant?.id ?? null, applicantEmail: applicant?.email ?? null, applicantName: applicant?.name ?? null,
      initiatedByType: input.actor.type, initiatedById: input.actor.id ?? null, initiatedByEmail: input.actor.email ?? null,
      source: `event:${input.type}`, data: event.data, clientVisibility: definition.clientVisibility,
    });
    await this.audit.record(tenantId, input.actor, 'case.created', { type: 'case', id: kase.id, reference: kase.reference }, { source: `event:${input.type}`, workflowVersion: version.version, eventId: event.id }, kase.id);
    await this.engine.start(tenantId, kase.id);
    return { id: kase.id, reference: kase.reference };
  }

  /** Events are kept a week (longer while a case still holds them for a step to come). */
  async prune() {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    for (const tenantId of await this.tenantIds()) {
      const db = this.repository.db(tenantId);
      await db.delete(inboundEvents).where(and(lt(inboundEvents.receivedAt, cutoff),
        sql`not exists (select 1 from ${caseEvents} where ${caseEvents.eventId} = ${inboundEvents.id} and ${caseEvents.status} = 'pending')`));
    }
  }

  private async tenantIds() {
    const rows = await this.databases.platform.execute(sql`select id from tenants`);
    return (rows as unknown as Array<{ id: string }>).map((r) => r.id);
  }
}
