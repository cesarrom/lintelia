'use server';

import { inject } from "@/lib/injector/utils";
import { DatabaseService } from "@/lib/services/database.service";
import { TableColumn } from "typeorm";
import { DatabaseNodeData } from "../../(workflows)/(components)/nodes/(database)/types";
import { LogsService } from "@/lib/services/logs.service";
import { TriggerBuilder } from "@/lib/triggers-utils";
import { TenantsService } from "@/lib/services/tenants.service";

export const listTables = inject(
  [DatabaseService, TenantsService],
  async ({ }, [dbService, tenantsService]) => {
    return dbService.listTables(await tenantsService.getContextualPlatformDBClient());
  }
);

export const getTableSchema = inject(
  [DatabaseService, TenantsService],
  async ({ }, [dbService, tenantsService], tableName: string) => {
    return dbService.getTableSchema(await tenantsService.getContextualPlatformDBClient(), tableName);
  }
);

export const executeQuery = inject(
  [DatabaseService, TenantsService, LogsService],
  async ({ }, [dbService, tenantsService, logsService], config: DatabaseNodeData) => {
    const db = await tenantsService.getContextualPlatformDBClient();
    switch (config.operation) {
      case 'create_table': {
        await dbService.createTable(
          db,
          config.schema.name,
          config.schema.columns.map(col => {
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
          })
        );

        logsService.info(`${TriggerBuilder.Events.DATABASE_CREATE} - ${config.schema.name}`, {
          metadata: {
            eventName: TriggerBuilder.Events.DATABASE_CREATE,
            table: config.schema.name,
            columns: config.schema.columns.map(col => col.name)
          }
        });

        return { success: true };
      } case 'read': {
        const conditions = config.conditions?.reduce((acc, condition) => {
          if (condition.operator === 'eq') {
            acc[condition.field] = condition.value;
          }
          return acc;
        }, {} as Record<string, any>);

        const result = await dbService.query(
          db,
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

        logsService.info(`${TriggerBuilder.Events.DATABASE_SELECT} - ${config.table}`, {
          metadata: {
            eventName: TriggerBuilder.Events.DATABASE_SELECT,
            table: config.table,
            conditions,
            result
          }
        });

        return result;
      } case 'insert': {
        const result = await dbService.insert(db, config.table, config.data);

        logsService.info(`${TriggerBuilder.Events.DATABASE_INSERT} - ${config.table}`, {
          metadata: {
            eventName: TriggerBuilder.Events.DATABASE_INSERT,
            table: config.table,
            data: config.data
          }
        });

        return result;
      } case 'update': {
        const updateConditions = config.conditions?.reduce((acc, condition) => {
          if (condition.operator === 'eq') {
            acc[condition.field] = condition.value;
          }
          return acc;
        }, {} as Record<string, any>);

        const result = await dbService.update(db, config.table, config.data, updateConditions);

        logsService.info(`${TriggerBuilder.Events.DATABASE_UPDATE} - ${config.table}`, {
          metadata: {
            eventName: TriggerBuilder.Events.DATABASE_UPDATE,
            table: config.table,
            data: config.data,
            conditions: updateConditions
          }
        });

        return result;
      } case 'delete': {
        const deleteConditions = config.conditions?.reduce((acc, condition) => {
          if (condition.operator === 'eq') {
            acc[condition.field] = condition.value;
          }
          return acc;
        }, {} as Record<string, any>);

        const result = await dbService.delete(db, config.table, deleteConditions);

        logsService.info(`${TriggerBuilder.Events.DATABASE_DELETE} - ${config.table}`, {
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
  }
);