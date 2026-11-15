import { AbstractService } from './service';
import { sql } from 'drizzle-orm';
import { TenantDatabase } from '../clients/database.client';
import { ColumnDefinition, DatabaseColumnTypes, type User, type Tenant } from '@repo/fintivio/schemas';
import { Inject, Injectable, Scope } from "@nestjs/common";
import { LogsService } from './logs.service';
import { DatabaseEvents } from '@repo/fintivio/utilities';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
@Injectable({
  scope: Scope.REQUEST
})
export class DatabaseService extends AbstractService {

  constructor(
    @Inject(LogsService) private readonly logsService: LogsService,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
  ) {
    super();
  }

  async createTable(connection: TenantDatabase, tableName: string, columns: ColumnDefinition[]) {
    await connection.execute(`
      CREATE TABLE ${tableName} (
        ${columns.map(column => {
      let expression = '';

      expression += column.name;
      expression += ' ';
      expression += column.type;

      if (column.defaultValue) {
        expression += ' DEFAULT ';
        expression += column.defaultValue;
      }

      if (!column.required) {
        expression += ' NULL';
      } else {
        expression += ' NOT NULL';
      }

      if (column.primary) {
        expression += ' PRIMARY KEY';
      }

      if (column.unique) {
        expression += ' UNIQUE';
      }

      return expression;
    }).join(', ')}
      )
    `);

    await this.logsService.justInsert(
      DatabaseEvents.TableCreated.log({
        tableId: tableName,
        tenantId: this.tenant.id!,
        userId: this.user.userId!,
      })
    );
  }

  async insert<T extends (Record<string, any> | Array<Record<string, any>>)>(
    connection: TenantDatabase,
    tableName: string,
    data: T
  ) {
    const d = [data].flat();
    let q = sql`INSERT INTO `
      .append(sql.raw(tableName))
      .append(sql`(`)
      .append(sql.raw(Object.keys(d[0]).join(', '))
        .append(sql`)`))
      .append(sql` VALUES (`);

    for (let itemIndex = 0; itemIndex < d.length; itemIndex++) {
      const item = d[itemIndex];
      const isLastItem = itemIndex === d.length - 1;
      const values = Object.values(item);

      for (let valueIndex = 0; valueIndex < values.length; valueIndex++) {
        const value = values[valueIndex];
        const isLastValue = valueIndex === values.length - 1;

        q = q.append(sql`${value}`);

        if (!isLastValue) {
          q = q.append(sql.raw(', '));
        }
      }

      if (!isLastItem) {
        q = q.append(sql.raw(', '));
      }
    }


    q = q.append(sql`)`)
      .append(sql` RETURNING *`);

    const result = await connection.execute(q as any);

    await this.logsService.justInsert(
      DatabaseEvents.RecordCreated.log()
    )

    if (Array.isArray(data)) {
      return result as unknown as T;
    }

    return result[0] as unknown as T;
  }

  async update<T extends Record<string, any>, RM extends (true | false)>(
    connection: TenantDatabase,
    tableName: string,
    data: Partial<T>,
    conditions: string,
    returnMany: RM = (false as any)
  ): Promise<RM extends true ? T[] : T> {
    let q = sql`UPDATE `
      .append(sql.raw(tableName))
      .append(sql` SET `);

    Object.entries(data).forEach(([key, value]) => {
      q = q.append(sql.raw(key));
      q = q.append(sql.raw(' = '));
      q = q.append(sql`${value}`);
    });

    q = q.append(conditions ? sql` WHERE ` : sql``)
      .append(sql.raw(conditions || ''))
      .append(sql` RETURNING *`);

    const result = await connection.execute(q as any);

    if (returnMany) {
      return result as any;
    }

    return result[0] as any;
  }

  async delete(
    connection: TenantDatabase,
    tableName: string,
    conditions?: string
  ) {
    let q = sql`DELETE FROM `
      .append(sql.raw(tableName))
      .append(conditions ? sql` WHERE ` : sql``)
      .append(sql.raw(conditions || ''));

    await connection.execute(q as any);

    return true;
  }

  async query<T extends Record<string, any>>(
    connection: TenantDatabase,
    tableName: string,
    conditions?: string,
    options?: {
      sort?: { field: string, direction: 'ASC' | 'DESC' }[],
      limit?: number,
      offset?: number
    }
  ) {
    let q = sql`SELECT * FROM `
      .append(sql.raw(tableName));

    if (conditions) {
      q = q.append(sql` WHERE `)
        .append(sql.raw(conditions));
    }

    if (options?.sort) {
      options.sort.forEach(sort => {
        q = q.append(sql` ORDER BY `)
          .append(sql.raw(sort.field))
          .append(sql.raw(' '))
          .append(sql.raw(sort.direction));
      });
    }

    q = q.append(sql` LIMIT `)
      .append(sql.raw((options?.limit || 100).toString()));

    if (options?.offset) {
      q = q.append(sql` OFFSET `)
        .append(sql.raw(options.offset.toString()));
    }

    const result = await connection.execute(q as any);

    return (result || []) as unknown as T[];
  }

  async listTables(connection: TenantDatabase): Promise<string[]> {
    const tables = await connection.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'` as any);
    return tables.map(table => table.table_name as string).filter(t => !t.startsWith('sys_') && !t.includes('typeorm'))
  }

  async getTableSchema(connection: TenantDatabase, tableName: string): Promise<{
    name: string;
    columns: ColumnDefinition[];
  }> {
    const [schemaColumns, constraints, indexes] = await Promise.all([
      connection.execute(sql`
    SELECT
      s.column_name,
      s.data_type,
      s.character_maximum_length,
      s.is_nullable,
      s.column_default,
      s.ordinal_position
    FROM
      information_schema.columns as s
    WHERE
      s.table_name = ${tableName};
  `),

      connection.execute(sql`
    SELECT con.contype, con.conname, con.conkey
    FROM pg_catalog.pg_constraint con
        INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
        WHERE rel.relname = ${tableName};`),
      connection.execute(sql`
    SELECT
      i.relname AS index_name,
      a.attname AS column_name
    FROM
      pg_class t,
      pg_class i,
      pg_index ix,
      pg_attribute a
    WHERE
      t.oid = ix.indrelid
      AND i.oid = ix.indexrelid
      AND a.attrelid = t.oid
      AND a.attnum = ANY(ix.indkey)
      AND t.relname = ${tableName};`)
    ]);

    if (!schemaColumns.length) {
      throw new Error(`Table ${tableName} not found`);
    }

    return {
      name: tableName,
      columns: schemaColumns.map(column => ({
        name: column.column_name,
        type: column.data_type as unknown as DatabaseColumnTypes,
        required: column.is_nullable === 'NO',
        primary: !!constraints.some(constraint => constraint.contype === 'p' && (constraint.conkey as any[]).includes(column.ordinal_position)),
        unique: !!indexes.some(index => index.index_name === column.column_name),
        defaultValue: column.column_default
      })) as ColumnDefinition[]
    };
  }
}