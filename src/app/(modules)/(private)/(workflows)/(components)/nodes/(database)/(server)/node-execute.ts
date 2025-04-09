import { events, DatabaseNodeDataSchema, DatabaseNodeData } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { DataSource, TableColumn } from "typeorm";
import { TENANT_DB_TOKEN } from "@/lib/injector/tokens";
import { DatabaseService as DBService } from "@/lib/services/database.service";
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { token, workflowInject } from "@/lib/injector/utils";
import { WorkflowExecutionsService } from "@/lib/services/workflow-executions.service";

export const databaseService = restate.object({
  name: "database",
  handlers: {
    executeNode: workflowInject(
      [DBService, token<DataSource>(TENANT_DB_TOKEN), WorkflowExecutionsService],
      async ({  }, [dbService, db, workflowExecutionsService], c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        const config = await c.run('validate-config', async () => {
          return DatabaseNodeDataSchema.parse(nodeData.config || {});
        });

        const variables = workflowExecutionsService.getConfiguration(config, r) as DatabaseNodeData;

        let result: Record<string, unknown> | Array<Record<string, unknown>> = {};
        let eventName: string;

        switch (variables.operation) {
          case 'insert':
            result = await dbService.insert(db, variables.table, variables.data);
            eventName = events.onInsert;
            break;

          case 'read':
            result = await dbService.query(
              db,
              variables.table,
              variables.conditions?.reduce((acc, condition) => {
                if (condition.operator === 'eq') {
                  acc[condition.field] = condition.value;
                }
                return acc;
              }, {} as Record<string, any>),
              {
                sort: variables.sort?.map(s => ({
                  field: s.field,
                  direction: s.direction.toUpperCase() as "ASC" | "DESC"
                })),
                limit: variables.limit,
                offset: variables.offset
              }
            );
            eventName = events.onRead;
            break;

          case 'update':
            const conditions = variables.conditions?.reduce((acc, condition) => {
              if (condition.operator === 'eq') {
                acc[condition.field] = condition.value;
              }
              return acc;
            }, {} as Record<string, any>);

            result = await dbService.update(db, variables.table, variables.data, conditions);
            eventName = events.onUpdate;
            break;

          case 'delete':
            const deleteConditions = variables.conditions?.reduce((acc, condition) => {
              if (condition.operator === 'eq') {
                acc[condition.field] = condition.value;
              }
              return acc;
            }, {} as Record<string, any>);

            result = { affected: await dbService.delete(db, variables.table, deleteConditions) };
            eventName = events.onDelete;
            break;

          case 'create_table':
            await dbService.createTable(db, variables.schema.name, variables.schema.columns.map(col => {
              const column = new TableColumn();
              column.name = col.name;
              column.type = col.type;
              column.isNullable = !col.required;
              column.isUnique = col.unique;
              column.default = col.defaultValue;
              column.isPrimary = false;
              column.isGenerated = false;
              column.isArray = false;
              column.length = '';
              column.generationStrategy = undefined;
              column.comment = '';
              return column;
            }));
            result = { success: true };
            eventName = events.onCreateTable;
            break;

          default:
            throw new Error(`Unsupported operation: ${(variables as Record<string, unknown>).operation}`);
        }

        return workflowExecutionsService.nextOrEndExecution({ nodeData, event: eventName, executionId, localResult: (result || {}) as Record<string, unknown>, globalResult: r, yaml, domain, token });
      }
    ),
  },
});

export type DatabaseService = typeof databaseService;
