import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { DatabaseService as DBService } from "../../services/database.service";
import { WorkflowExecutionsService } from "../../services/workflow-executions.service";
import { DatabaseNodeConfig, databaseNodeConfigSchema, WORKFLOW_EVENTS, GetTablesResponse } from "@repo/fintivio/schemas";
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { LogsService } from "../../services/logs.service";
import { TriggerBuilder } from "@repo/fintivio/utilities";
import { RestateService } from "./restate.abstract.service";
import { TENANT_CONNECTION } from "../../injector/tokens/tenant-connection.token";
import { type TenantDatabase } from "../../clients/database.client";
import { Injectable, Scope, Inject } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class DatabaseService extends RestateService<'database'> {
  object = object({
    name: "database",
    handlers: {
      executeNode: async (c: ObjectContext, { executionId, nodeData, workflowId, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        const config = await c.run('validate-config', async () => {
          return databaseNodeConfigSchema.parse(nodeData.config || {});
        });

        const variables = this.workflowExecutionsService.getConfiguration(config, r) as DatabaseNodeConfig;

        let result: Record<string, unknown> | Array<Record<string, unknown>> = {};
        let eventName: string;

        switch (variables.operation) {
          case 'insert':
            result = await this.dbService.insert(this.db, variables.table, variables.data);
            eventName = WORKFLOW_EVENTS.database.onInsert;
            break;

          case 'read':
            result = await this.dbService.query(
              this.db,
              variables.table,
              variables.conditions || '',
              {
                sort: variables.sort?.map(s => ({
                  field: s.field,
                  direction: s.direction.toUpperCase() as "ASC" | "DESC"
                })),
                limit: variables.limit,
                offset: variables.offset
              }
            );
            eventName = WORKFLOW_EVENTS.database.onRead;
            break;

          case 'update':
            result = await this.dbService.update(this.db, variables.table, variables.data, variables.conditions);
            eventName = WORKFLOW_EVENTS.database.onUpdate;
            break;

          case 'delete':
            result = { affected: await this.dbService.delete(this.db, variables.table, variables.conditions) };
            eventName = WORKFLOW_EVENTS.database.onDelete;
            break;

          case 'create_table':
            await this.dbService.createTable(this.db, variables.schema.name, variables.schema.columns);
            result = { success: true };
            eventName = WORKFLOW_EVENTS.database.onCreateTable;
            break;

          default:
            throw new Error(`Unsupported operation: ${(variables as Record<string, unknown>).operation}`);
        }

        return this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: eventName, executionId, localResult: (result || {}) as Record<string, unknown>, globalResult: r, workflowId, domain, token });
      },
      listTables: async (c: ObjectContext) => {
        return this.dbService.listTables(this.db);
      },
      getTableSchema: async (c: ObjectContext, tableName: string): Promise<GetTablesResponse> => {
        return this.dbService.getTableSchema(this.db, tableName);
      },
      executeQuery: async (c: ObjectContext, config: DatabaseNodeConfig) => {
        switch (config.operation) {
          case 'create_table': {
            await this.dbService.createTable(
              this.db,
              config.schema.name,
              config.schema.columns,
            );

            this.logsService.info(`${TriggerBuilder.Events.DATABASE_CREATE} - ${config.schema.name}`, {
              metadata: {
                eventName: TriggerBuilder.Events.DATABASE_CREATE,
                table: config.schema.name,
                columns: config.schema.columns.map(col => col.name)
              }
            });

            return { success: true };
          } case 'read': {
            const conditions = config.conditions || '';

            const result = await this.dbService.query(
              this.db,
              config.table,
              conditions,
              {
                sort: config.sort?.map(s => ({
                  field: s.field,
                  direction: s.direction.toUpperCase() as 'ASC' | 'DESC'
                })),
                limit: config.limit,
                offset: config.offset
              }
            );

            this.logsService.info(`${TriggerBuilder.Events.DATABASE_SELECT} - ${config.table}`, {
              metadata: {
                eventName: TriggerBuilder.Events.DATABASE_SELECT,
                table: config.table,
                conditions,
                result
              }
            });

            return result;
          } case 'insert': {
            const result = await this.dbService.insert(this.db, config.table, config.data);

            this.logsService.info(`${TriggerBuilder.Events.DATABASE_INSERT} - ${config.table}`, {
              metadata: {
                eventName: TriggerBuilder.Events.DATABASE_INSERT,
                table: config.table,
                data: config.data
              }
            });

            return result;
          } case 'update': {
            const updateConditions = config.conditions || '';

            const result = await this.dbService.update(this.db, config.table, config.data, updateConditions);

            this.logsService.info(`${TriggerBuilder.Events.DATABASE_UPDATE} - ${config.table}`, {
              metadata: {
                eventName: TriggerBuilder.Events.DATABASE_UPDATE,
                table: config.table,
                data: config.data,
                conditions: updateConditions
              }
            });

            return result;
          } case 'delete': {
            const deleteConditions = config.conditions || '';

            const result = await this.dbService.delete(this.db, config.table, deleteConditions);

            this.logsService.info(`${TriggerBuilder.Events.DATABASE_DELETE} - ${config.table}`, {
              metadata: {
                eventName: TriggerBuilder.Events.DATABASE_DELETE,
                table: config.table,
                conditions: deleteConditions
              }
            });

            return result;
          } default: {
            throw new Error(`Unsupported operation: ${(config as any).operation}`);
          }
        }
      },
    },
  });

  constructor(
    @Inject(DBService) private dbService: DBService,
    @Inject(TENANT_CONNECTION) private db: TenantDatabase,
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
    @Inject(LogsService) private logsService: LogsService,

  ) {
    super();
  }
}
