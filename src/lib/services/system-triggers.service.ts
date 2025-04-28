import { inject as i, injectable } from 'tsyringe';
import { TENANT_DB_TOKEN, USER_TOKEN } from '../injector/tokens';
import { DataSource, In, Repository } from 'typeorm';
import { SystemTrigger } from '../entities/tenant/system-trigger.entity';
import { LogsService } from './logs.service';
import { Log, LogCategory } from '../entities/tenant/log.entity';
import { type User } from '@/types/auth';
import Mustache from 'mustache';
import { inject, optional } from '../injector/utils';
import { TriggerDefinition } from '../triggers-utils';
import { env } from '../constants';
import { v4 as uuid } from 'uuid';
import { Tenant } from '../entities/global';
import { auth } from '../clients/auth.client';
import { session } from '@descope/nextjs-sdk/server';
@injectable()
export class SystemTriggersService {
  private repository: Repository<SystemTrigger>;

  constructor(
    @i(TENANT_DB_TOKEN) private conn: DataSource,
    @i(USER_TOKEN) private user: User,
  ) {
    this.repository = this.conn.getRepository(SystemTrigger);
  }

  findTriggerById(triggerId: string): Promise<SystemTrigger | null> {
    return this.repository.findOne({ where: { id: triggerId } });
  }

  async deleteTriggerById(triggerId: string): Promise<void> {
    await this.repository.delete({ id: triggerId });
  }

  async replaceTrigger(triggerId: string, trigger: SystemTrigger): Promise<SystemTrigger> {
    return this.conn.transaction(async (em) => {
      await em.delete(SystemTrigger, { id: triggerId });
      trigger.id = triggerId;
      return await em.save(trigger);
    });
  }

  swapTriggersForWorkflow(oldTriggerIds: string[], newTriggers: SystemTrigger[]) {
    return this.conn.transaction(async (em) => {
      await em.delete(SystemTrigger, { id: In(oldTriggerIds) });
      return await em.save(newTriggers);
    });
  }

  /**
   * Static method to wrap a function with logging
   */
  static withLogging<T extends any[], R extends unknown>(category: LogCategory, eventName: string, handler: (...args: T) => Promise<R>): (...args: T) => Promise<R> {
    return inject(
      [LogsService],
      async ({ user }, [logsService], ...args: T): Promise<R> => {
        // Log start
        await logsService.create({
          message: `Event handler started: ${category} :: ${eventName}`,
          category,
          level: 'info',
          metadata: {
            eventName,
            triggeredBy: user?.userId || 'system',
          }
        });

        try {
          const r: R = await handler(...args);

          // Log success
          await logsService.create({
            message: `Event handler completed: ${category} :: ${eventName}`,
            category,
            level: 'info',
            metadata: {
              eventName,
              triggeredBy: user?.userId || 'system',
            }
          });

          return r;
        } catch (error) {
          // Log error
          await logsService.create({
            message: `Event handler failed: ${category} :: ${eventName}`,
            category,
            level: 'error',
            metadata: {
              eventName,
              error: error instanceof Error ? error.message : String(error),
              triggeredBy: user?.userId || 'system',
            }
          });

          throw error;
        }
      });
  }

  /**
   * Find matching triggers for a log using PostgreSQL pattern matching and JSONB operations
   */
  async findMatchingTriggers(log: Log): Promise<SystemTrigger[]> {
    const queryBuilder = this.repository.createQueryBuilder('trigger')
      .where('trigger.is_active = :isActive', { isActive: true });

    // Add pattern matching conditions
    if (log.category) {
      queryBuilder.andWhere(`
        (pattern->>'category' IS NULL OR :category LIKE pattern->>'category')
      `, { category: log.category });
    }

    if (log.message) {
      queryBuilder.andWhere(`
        (pattern->>'message' IS NULL OR :message LIKE pattern->>'message')
      `, { message: log.message });
    }

    if (log.level) {
      queryBuilder.andWhere(`
        (pattern->>'level' IS NULL OR pattern->>'level' = :level)
      `, { level: log.level });
    }

    if (log.source) {
      queryBuilder.andWhere(`
        (pattern->>'source' IS NULL OR :source LIKE pattern->>'source')
      `, { source: log.source });
    }

    if (log.metadata) {
      // Use JSONB containment for metadata patterns
      queryBuilder.andWhere(`
        EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(pattern->'metadata') AS meta
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
              (:log)::jsonb,
              VARIADIC paths.elements
            ) IS NOT NULL
            AND
            jsonb_extract_path(
              (:log)::jsonb,
              VARIADIC paths.elements
            )::jsonb @> (meta->'pattern')::jsonb
        )
      `, { log: JSON.stringify(log) });
    }

    return queryBuilder.getMany();
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

  executeTrigger = inject(
    [],
    async ({ tenant }, [], trigger: SystemTrigger, inputs: Record<string, unknown>): Promise<void> => {
      const executionId = uuid();
      const token = session();

      if (trigger.action.type === 'INVOKE') {
        await fetch(`${env.RESTATE_ENDPOINT}/workflow/${executionId}/trigger`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            variables: inputs,
            workflowId: trigger.workflowId,
            token: token?.jwt,
            domain: tenant?.domain,
          }),
        });
      } else if (trigger.action.type === 'RESUME') {
        await fetch(`${env.RESTATE_ENDPOINT}/workflow/${executionId}/resume`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            resumableId: trigger.id,
            result: inputs,
            token: token?.jwt,
            domain: tenant?.domain,
          }),
        });
      } else {
        throw new Error('Invalid trigger action type');
      }
    }
  )

  // Service methods now accept TriggerDefinition
  async createTrigger(definition: SystemTrigger): Promise<SystemTrigger> {
    return await this.repository.save({
      ...definition,
      createdBy: this.user.userId || 'system',
    });
  }

  async putTrigger(id: string, definition: SystemTrigger) {
    const exists = await this.repository.findOne({
      where: { id },
    });

    if (exists) {
      return await this.replaceTrigger(id, definition);
    }

    return await this.createTrigger(definition);
  }

  async getAllByWorkflowId(workflowId: string): Promise<SystemTrigger[]> {
    return await this.repository.createQueryBuilder('system_trigger')
      .where("action->>'workflowId' = :workflowId", { workflowId })
      .getMany();
  }
} 