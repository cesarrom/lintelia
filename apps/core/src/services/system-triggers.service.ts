import { sysSystemTriggers } from '../entities/tenants';
import Mustache from 'mustache';
import { AbstractService } from './service';
import { eq, inArray, sql } from 'drizzle-orm';
import { CasesService } from './cases.service';
import { WebService } from './web.service';
import { Log, SystemTrigger, type Tenant } from '@repo/lintelia/schemas';
import { TENANT_CONNECTION } from '../injector/tokens/tenant-connection.token';
import { type TenantDatabase } from '../clients/database.client';
import { TENANT } from '../injector/tokens/tenant.token';
import { Injectable, Inject, Scope } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class SystemTriggersService extends AbstractService {

  constructor(
    @Inject(TENANT_CONNECTION) private db: TenantDatabase,
    @Inject(TENANT) private tenantValueService: Tenant,
    @Inject(CasesService) private readonly cases: CasesService,
    @Inject(WebService) private webService: WebService,
  ) { super(); }

  async findTriggerById(triggerId: string): Promise<SystemTrigger | null> {
    const [result] = await this.db.select().from(sysSystemTriggers).where(eq(sysSystemTriggers.id, triggerId)).execute();
    return result;
  }

  async deleteTriggerById(triggerId: string): Promise<void> {
    await this.db.delete(sysSystemTriggers).where(eq(sysSystemTriggers.id, triggerId)).returning().execute();
  }

  async replaceTrigger(triggerId: string, trigger: SystemTrigger): Promise<SystemTrigger> {
    return this.db.transaction(async (tdb) => {
      await tdb.delete(sysSystemTriggers).where(eq(sysSystemTriggers.id, triggerId)).returning().execute();
      trigger.id = triggerId;
      const [result] = await tdb.insert(sysSystemTriggers).values(trigger).returning().execute();
      return result;
    });
  }

  async swapTriggersForWorkflow(oldTriggerIds: string[], newTriggers: SystemTrigger[]) {
    return this.db.transaction(async (tdb) => {
      if (oldTriggerIds.length) await tdb.delete(sysSystemTriggers).where(inArray(sysSystemTriggers.id, oldTriggerIds)).returning().execute();
      if (!newTriggers.length) return undefined;
      const [result] = await tdb.insert(sysSystemTriggers).values(newTriggers).returning().execute();
      return result;
    });
  }

  /**
   * Find matching triggers for a log using PostgreSQL pattern matching and JSONB operations
   */
  async findMatchingTriggers(log: Log): Promise<SystemTrigger[]> {
    let q = sql`${sysSystemTriggers.isActive} = ${true} `;


    // Add pattern matching conditions
    if (log.category) {
      q = q.append(sql` AND (${sysSystemTriggers.pattern}->>'category' IS NULL OR ${log.category} LIKE ${sysSystemTriggers.pattern}->>'category') `);
    }

    if (log.message) {
      q = q.append(sql` AND (${sysSystemTriggers.pattern}->>'message' IS NULL OR ${log.message} LIKE ${sysSystemTriggers.pattern}->>'message') `);
    }

    if (log.level) {
      q = q.append(sql` AND (${sysSystemTriggers.pattern}->>'level' IS NULL OR ${log.level} = ${sysSystemTriggers.pattern}->>'level') `);
    }

    if (log.source) {
      q = q.append(sql` AND (${sysSystemTriggers.pattern}->>'source' IS NULL OR ${log.source} LIKE ${sysSystemTriggers.pattern}->>'source') `);
    }

    if (log.metadata) {
      const logString = JSON.stringify(log);
      // Use JSONB containment for metadata patterns
      q = q.append(sql`
        AND EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(${sysSystemTriggers.pattern}->'metadata') AS meta
          CROSS JOIN LATERAL (
            SELECT array_agg(obj.path_text::text) AS elements
            FROM (
              SELECT
                1 AS id, 
                path_text
              FROM jsonb_array_elements_text(meta::jsonb->'path') AS path_text
            ) AS obj
            GROUP BY obj.id
          ) AS paths
          WHERE 
            jsonb_extract_path_text(
              (${logString})::jsonb,
              VARIADIC paths.elements
            ) IS NOT NULL
            AND
            jsonb_extract_path(
              (${logString})::jsonb,
              VARIADIC paths.elements
            )::jsonb @> (meta->'pattern')::jsonb
        )
      `);
    }

    return await this.db.select().from(sysSystemTriggers).where(q).execute();
  }

  private getInputs(log: Log, definition: SystemTrigger) {
    const jsonStr = JSON.stringify(definition?.action?.inputs || {});
    const values = Mustache.render(jsonStr, { ...log, Triggers: { [definition.name]: log.metadata || {} } });
    return JSON.parse(values);
  }

  /**
   * Process a log and execute matching triggers
   */
  async processLog(log: Log): Promise<void> {
    const triggers = await this.findMatchingTriggers(log);

    for (const trigger of triggers) {
      const inputs = this.getInputs(log, trigger);
      await this.executeTrigger(trigger, inputs);

    }
  }

  /**
   * A matching log pattern starts a case on the trigger's workflow (its published version), as the system. Resuming
   * a waiting execution belonged to the legacy node engine, which is no longer reachable (it carried user tokens into
   * the Restate journal).
   */
  async executeTrigger(trigger: SystemTrigger, inputs: Record<string, unknown>): Promise<void> {
    if (trigger.action.type !== 'INVOKE') {
      console.warn(`System trigger ${trigger.id}: ${trigger.action.type} is not supported by the case engine`);
      return;
    }
    await this.cases.start({
      workflowId: String(trigger.workflowId), data: inputs, source: `trigger:${trigger.name}`,
      initiatedBy: { type: 'system', id: null, email: `trigger:${trigger.name}` },
    });
  }


  // Service methods now accept TriggerDefinition
  async createTrigger(definition: SystemTrigger): Promise<SystemTrigger> {
    const userId = await this.webService.getUserId()
    const [result] = await this.db.insert(sysSystemTriggers).values({
      ...definition,
      createdBy: userId || 'system',
    }).returning().execute();
    return result;
  }

  async putTrigger(id: string, definition: SystemTrigger) {
    const [exists] = await this.db.select().from(sysSystemTriggers).where(eq(sysSystemTriggers.id, id)).limit(1).execute();

    if (exists) {
      return await this.replaceTrigger(id, definition);
    }

    return await this.createTrigger(definition);
  }

  async getAllByWorkflowId(workflowId: string): Promise<SystemTrigger[]> {
    const q = sql`${sysSystemTriggers.action}->>\'workflowId\' = ${workflowId}`;
    const rows = await this.db.select().from(sysSystemTriggers).where(q).execute();
    return rows;
  }
} 