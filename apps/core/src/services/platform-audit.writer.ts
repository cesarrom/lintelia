import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { platformAuditEvents } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import type { AuditActor, AuditTarget } from './audit.writer';

/** The platform's append-only, hash-chained audit trail (staff actions), written through the platform connection. */
@Injectable()
export class PlatformAuditWriter {
  constructor(@Inject(DATABASES) private readonly databases: Databases) { }

  async record(actor: AuditActor, action: string, target?: AuditTarget | null, tenant?: { id: string; domain: string } | null, details: Record<string, unknown> = {}) {
    return this.databases.platform.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('platform_audit', 0))`);
      const [last] = await tx.select({ seq: platformAuditEvents.seq, hash: platformAuditEvents.hash }).from(platformAuditEvents).orderBy(desc(platformAuditEvents.seq)).limit(1);
      const seq = (last?.seq ?? 0) + 1;
      const at = new Date();
      const { type: targetType, id: targetId, ...targetRest } = target ?? { type: null, id: null };
      const allDetails = { ...targetRest, ...details };
      const previousHash = last?.hash ?? null;
      const hash = createHash('sha256').update(JSON.stringify({
        seq, at: at.toISOString(), actor: { type: actor.type, id: actor.id ?? null, email: actor.email ?? null }, action,
        targetType, targetId: targetId ?? null, tenantId: tenant?.id ?? null, details: allDetails, previousHash,
      })).digest('hex');
      const [row] = await tx.insert(platformAuditEvents).values({
        seq, at, actorType: actor.type, actorId: actor.id ?? null, actorEmail: actor.email ?? null, action,
        targetType: targetType ?? null, targetId: targetId ?? null, tenantId: tenant?.id ?? null, tenantKey: tenant?.domain ?? null,
        details: allDetails, previousHash, hash,
      }).returning();
      return row;
    });
  }

  async list(filter: { tenant?: string; action?: string; limit?: number } = {}) {
    const conditions: SQL[] = [];
    if (filter.tenant) conditions.push(eq(platformAuditEvents.tenantKey, filter.tenant));
    if (filter.action) conditions.push(eq(platformAuditEvents.action, filter.action));
    const rows = await this.databases.platform.select().from(platformAuditEvents)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(platformAuditEvents.seq)).limit(Math.min(filter.limit ?? 500, 5000));
    return rows.map((row) => ({
      id: row.id, seq: row.seq, at: row.at.toISOString(),
      actor: { type: row.actorType, id: row.actorId, email: row.actorEmail },
      action: row.action, target: { type: row.targetType, id: row.targetId }, tenant: row.tenantKey,
      details: row.details, hash: row.hash, previousHash: row.previousHash,
    }));
  }
}
