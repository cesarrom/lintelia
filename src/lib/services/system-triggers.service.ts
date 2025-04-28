import { inject as i, injectable } from 'tsyringe';
import { DataSource, In, ObjectLiteral, Repository } from 'typeorm';
import { SystemTrigger } from '../entities';
import { Log } from '../entities';
import Mustache from 'mustache';
import { inject } from '../injector/utils';
import { env } from '../constants';
import { v4 as uuid } from 'uuid';
import { session } from '@descope/nextjs-sdk/server';
import { TenantsService } from './tenants.service';
import { Newable, Service } from './service';
import { UsersService } from './users.service';
@injectable()
export class SystemTriggersService extends Service {
  private conn: DataSource | null = null;
  private repositories: Map<Newable<any>, Repository<any>> = new Map();

  static dependencies() {
    return [
      TenantsService,
      UsersService,
    ]
  }

  constructor(
    @i(TenantsService) private tenantsService: TenantsService,
    @i(UsersService) private usersService: UsersService,
  ) { super(); }

  async getConnection(): Promise<DataSource> {
    if (this.conn) return this.conn;
    this.conn = await this.tenantsService.getContextualPlatformDBClient();
    return this.conn;
  }


  async getRepository<T extends ObjectLiteral>(cls: Newable<T>): Promise<Repository<T>> {
    if (this.repositories.has(cls)) {
      return this.repositories.get(cls)!;
    }
    const conn = await this.getConnection();
    const repository = conn.getRepository(cls);
    this.repositories.set(cls, repository);
    return repository! as any;
  }

  async findTriggerById(triggerId: string): Promise<SystemTrigger | null> {
    const repository = await this.getRepository(SystemTrigger);
    return repository.findOne({ where: { id: triggerId } });
  }

  async deleteTriggerById(triggerId: string): Promise<void> {
    const repository = await this.getRepository(SystemTrigger);
    await repository.delete({ id: triggerId });
  }

  async replaceTrigger(triggerId: string, trigger: SystemTrigger): Promise<SystemTrigger> {
    const conn = await this.getConnection();
    return conn.transaction(async (em) => {
      await em.delete(SystemTrigger, { id: triggerId });
      trigger.id = triggerId;
      return await em.save(trigger);
    });
  }

  async swapTriggersForWorkflow(oldTriggerIds: string[], newTriggers: SystemTrigger[]) {
    const conn = await this.getConnection();
    return conn.transaction(async (em) => {
      await em.delete(SystemTrigger, { id: In(oldTriggerIds) });
      return await em.save(newTriggers);
    });
  }

  /**
   * Find matching triggers for a log using PostgreSQL pattern matching and JSONB operations
   */
  async findMatchingTriggers(log: Log): Promise<SystemTrigger[]> {
    const repository = await this.getRepository(SystemTrigger);
    const queryBuilder = repository.createQueryBuilder('trigger')
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
      const token = await session();

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
            workflowId: trigger.workflowId,
          }),
        });
      } else {
        throw new Error('Invalid trigger action type');
      }
    }
  )

  // Service methods now accept TriggerDefinition
  async createTrigger(definition: SystemTrigger): Promise<SystemTrigger> {
    const user = await this.usersService.getSessionUser();
    const repository = await this.getRepository(SystemTrigger);
    return await repository.save({
      ...definition,
      createdBy: user?.userId || 'system',
    });
  }

  async putTrigger(id: string, definition: SystemTrigger) {
    const repository = await this.getRepository(SystemTrigger);
    const exists = await repository.findOne({
      where: { id },
    });

    if (exists) {
      return await this.replaceTrigger(id, definition);
    }

    return await this.createTrigger(definition);
  }

  async getAllByWorkflowId(workflowId: string): Promise<SystemTrigger[]> {
    const repository = await this.getRepository(SystemTrigger);
    return await repository.createQueryBuilder('system_trigger')
      .where("action->>'workflowId' = :workflowId", { workflowId })
      .getMany();
  }
} 