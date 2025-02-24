'use server';

import { inject } from "@/lib/injector/utils";
import { DatabaseService } from "@/lib/services/database.service";
import { TENANT_DB_TOKEN } from "@/lib/injector/tokens";
import { DataSource, TableColumn } from "typeorm";
import { DatabaseNodeData } from "../types";
import { token } from "@/lib/injector/utils";

export const listTables = inject(
  [token<DataSource>(TENANT_DB_TOKEN), DatabaseService],
  async ({ }, [db, dbService]) => {
    return dbService.listTables(db);
  }
);

export const getTableSchema = inject(
  [token<DataSource>(TENANT_DB_TOKEN), DatabaseService],
  async ({ }, [db, dbService], tableName: string) => {
    return dbService.getTableSchema(db, tableName);
  }
);

export const executeQuery = inject(
  [token<DataSource>(TENANT_DB_TOKEN), DatabaseService],
  async ({ }, [db, dbService], config: DatabaseNodeData) => {
    switch (config.operation) {
      case 'create_table':
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
        return { success: true };

      case 'read':
        const conditions = config.conditions?.reduce((acc, condition) => {
          if (condition.operator === 'eq') {
            acc[condition.field] = condition.value;
          }
          return acc;
        }, {} as Record<string, any>);

        return dbService.query(
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

      case 'insert':
        return dbService.insert(db, config.table, config.data);

      case 'update':
        const updateConditions = config.conditions?.reduce((acc, condition) => {
          if (condition.operator === 'eq') {
            acc[condition.field] = condition.value;
          }
          return acc;
        }, {} as Record<string, any>);

        return dbService.update(db, config.table, config.data, updateConditions);

      case 'delete':
        const deleteConditions = config.conditions?.reduce((acc, condition) => {
          if (condition.operator === 'eq') {
            acc[condition.field] = condition.value;
          }
          return acc;
        }, {} as Record<string, any>);

        return dbService.delete(db, config.table, deleteConditions);

      default:
        throw new Error(`Unsupported operation: ${(config as any).operation}`);
    }
  }
);