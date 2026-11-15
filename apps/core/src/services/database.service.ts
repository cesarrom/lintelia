import { HttpException, Injectable, Scope } from "@nestjs/common";
import type { ColumnDefinition, GetTablesResponse } from '@repo/fintivio/schemas';
import { AbstractService } from './service';
import type { TenantDatabase } from '../clients/database.client';

const DISABLED_MESSAGE =
  'Custom tenant tables are disabled: they ran raw SQL (CREATE TABLE, free-text WHERE conditions, arbitrary table ' +
  'names), which cannot be isolated in the shared multi-tenant database. They need a redesign (tenant-defined ' +
  'collections stored under row level security with a structured filter language).';

export class FeatureUnavailableError extends HttpException {
  constructor(message = DISABLED_MESSAGE) {
    super({ statusCode: 501, error: 'Not Implemented', message }, 501);
  }
}

/**
 * Tenant-defined tables ("Database" section and the `database` workflow node).
 *
 * When every tenant had its own database this executed tenant-supplied SQL directly. In the single shared database
 * that would let a tenant read other tables (e.g. `users` password hashes), change `app.tenant_id` from inside a
 * WHERE clause, or create tables without row level security. The previous implementation is in git history
 * (apps/core/src/services/database.service.ts before the RLS migration). Every operation now fails with 501.
 */
@Injectable({
  scope: Scope.REQUEST
})
export class DatabaseService extends AbstractService {
  async createTable(_connection: TenantDatabase, _tableName: string, _columns: ColumnDefinition[]): Promise<void> {
    throw new FeatureUnavailableError();
  }

  async insert<T extends (Record<string, any> | Array<Record<string, any>>)>(_connection: TenantDatabase, _tableName: string, _data: T): Promise<T> {
    throw new FeatureUnavailableError();
  }

  async update<T extends Record<string, any>, RM extends (true | false)>(_connection: TenantDatabase, _tableName: string, _data: Partial<T>, _conditions: string, _returnMany?: RM): Promise<RM extends true ? T[] : T> {
    throw new FeatureUnavailableError();
  }

  async delete(_connection: TenantDatabase, _tableName: string, _conditions?: string): Promise<boolean> {
    throw new FeatureUnavailableError();
  }

  async query<T extends Record<string, any>>(_connection: TenantDatabase, _tableName: string, _conditions?: string, _options?: unknown): Promise<T[]> {
    throw new FeatureUnavailableError();
  }

  async listTables(_connection: TenantDatabase): Promise<string[]> {
    throw new FeatureUnavailableError();
  }

  async getTableSchema(_connection: TenantDatabase, _tableName: string): Promise<GetTablesResponse> {
    throw new FeatureUnavailableError();
  }
}
