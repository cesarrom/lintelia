import { Access, Require } from "../auth/access";
import { DatabaseService as DBService } from "../services/database.service";
import { type DatabaseNodeConfig, GetTablesResponse } from "@repo/fintivio/schemas";
import { LogsService } from "../services/logs.service";
import { TriggerBuilder } from "@repo/fintivio/utilities";
import { TENANT_CONNECTION } from "../injector/tokens/tenant-connection.token";
import { type TenantDatabase } from "../clients/database.client";
import { Scope, Inject, Controller, Get, Post, Res, Param } from "@nestjs/common";
import type { Context } from "hono";
import assert from "assert";
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";

@Controller({
  path: '/databases',
  scope: Scope.REQUEST
})
export class DatabaseHandler {
  constructor(
    @Inject(DBService) private dbService: DBService,
    @Inject(TENANT_CONNECTION) private db: TenantDatabase,
    @Inject(LogsService) private logsService: LogsService,
    @Inject(REQUEST_PROXY) private requestProxy: AppRequest,
  ) { }

  @Require('workspace:read')
  @Get('/tables')
  async listTables(@Res() ctx: Context): Promise<void> {
    const result = await this.dbService.listTables(this.db);
    ctx.res = new Response(JSON.stringify(result || []), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return;
  }

  @Require('workspace:read')
  @Get('/schemas/:tableName')
  async getTableSchema(@Res() ctx: Context, @Param('tableName') tableName: string): Promise<void> {
    assert(tableName, 'tableName parameter is required');

    const result: GetTablesResponse = await this.dbService.getTableSchema(this.db, tableName);
    ctx.res = new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return;
  }

  @Require('workspace:read')
  @Post('/execute-query')
  async executeQuery(@Res() ctx: Context): Promise<void> {
    const config: DatabaseNodeConfig = await this.requestProxy.json();

    console.log(config);
    
    let result: any;

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

        result = { success: true };
        break;
      } case 'read': {
        const conditions = config.conditions || '';

        result = await this.dbService.query(
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
        break;
      } case 'insert': {
        result = await this.dbService.insert(this.db, config.table, config.data);

        this.logsService.info(`${TriggerBuilder.Events.DATABASE_INSERT} - ${config.table}`, {
          metadata: {
            eventName: TriggerBuilder.Events.DATABASE_INSERT,
            table: config.table,
            data: config.data
          }
        });
        break;
      } case 'update': {
        const updateConditions = config.conditions || '';

        result = await this.dbService.update(this.db, config.table, config.data, updateConditions);

        this.logsService.info(`${TriggerBuilder.Events.DATABASE_UPDATE} - ${config.table}`, {
          metadata: {
            eventName: TriggerBuilder.Events.DATABASE_UPDATE,
            table: config.table,
            data: config.data,
            conditions: updateConditions
          }
        });
        break;
      } case 'delete': {
        const deleteConditions = config.conditions || '';

        result = await this.dbService.delete(this.db, config.table, deleteConditions);

        this.logsService.info(`${TriggerBuilder.Events.DATABASE_DELETE} - ${config.table}`, {
          metadata: {
            eventName: TriggerBuilder.Events.DATABASE_DELETE,
            table: config.table,
            conditions: deleteConditions
          }
        });
        break;
      } default: {
        ctx.res = new Response(JSON.stringify({ error: 'Unknown database operation' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 400
        });
        return;
      }
    }

    ctx.res = new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return;
  }

  @Require('workspace:read')
  @Post('/schemas/:tableName')
  async createTableSchema(@Res() ctx: Context, @Param('tableName') tableName: string): Promise<void> {
    
    assert(tableName, 'tableName parameter is required');

    const schema: GetTablesResponse = await this.requestProxy.json();

    await this.dbService.createTable(this.db, tableName, schema.columns);

    ctx.res = new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return;
  }
}
