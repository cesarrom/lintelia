import { injectable, singleton } from 'tsyringe';
import { Resource } from 'sst';
import { env } from '../constants';
import * as globalEntities from '../entities/global';
import * as tenantEntities from '../entities/tenant';
import * as globalMigrations from '../../migrations/global';
import * as tenantMigrations from '../../migrations/tenant';
import { DataSource, DataSourceOptions, Table, TableColumn } from 'typeorm';
import { branchId, endpoint, neon, projectId } from '../clients/neon.client';
import { wait } from '../utils';

@injectable()
@singleton()
export class DatabaseService {
  private static globalConnection: DataSource | null = null;
  private tenantConnections: Map<string, DataSource> = new Map();

  constructor() { }

  static getGlobalConfig(): DataSourceOptions {
    const dbUrl = new URL(env.DATABASE_CORE_URL);

    return {
      type: 'postgres',
      url: dbUrl.toString(),
      entities: Object.values(globalEntities),
      migrations: Object.values(globalMigrations),
      migrationsTableName: 'typeorm_migrations',
      logging: true,
      synchronize: false,
      entitySkipConstructor: true,
      migrationsRun: true,
      relationLoadStrategy: 'join',
      maxQueryExecutionTime: 1000,
      extra: {
        max: 30
      }
    };
  }

  static getTenantConfig(url: string): DataSourceOptions {
    const dbUrl = new URL(url);

    return {
      type: 'postgres',
      url: dbUrl.toString(),
      entities: Object.values(tenantEntities),
      migrations: Object.values(tenantMigrations),
      migrationsTableName: 'typeorm_migrations',
      logging: true,
      synchronize: false,
      entitySkipConstructor: true,
      migrationsRun: true,
      relationLoadStrategy: 'join',
      maxQueryExecutionTime: 1000,
      extra: {
        max: 30
      }
    };
  }

  async getGlobalConnection() {
    if (!DatabaseService.globalConnection) {
      const config = DatabaseService.getGlobalConfig();
      DatabaseService.globalConnection = new DataSource(config);
      await DatabaseService.globalConnection.initialize();
    }
    return DatabaseService.globalConnection;
  }

  async getTenantConnection(domain: string, url: string) {
    if (!this.tenantConnections.has(domain)) {
      try {
        const config = DatabaseService.getTenantConfig(url);
        const connection = new DataSource(config);
        
        await connection.initialize();
        
        await connection.synchronize(false);
        
        try {
          await connection.runMigrations({
            transaction: 'each'
          });
        } catch (error) {
          console.error(`Failed to run migrations for tenant ${domain}:`, error);
          await connection.destroy();
          throw error;
        }
        
        this.tenantConnections.set(domain, connection);
      } catch (error) {
        console.error(`Failed to initialize tenant connection for ${domain}:`, error);
        throw error;
      }
    }
    return this.tenantConnections.get(domain)!;
  }

  async createTable(connection: DataSource, tableName: string, columns: TableColumn[]) {
    const queryRunner = connection.createQueryRunner();
    await queryRunner.createTable(new Table({
      name: tableName,
      columns
    }));
    await queryRunner.release();
  }

  async insert<T extends Record<string, any>>(
    connection: DataSource,
    tableName: string,
    data: T | T[]
  ) {
    const result = await connection.createQueryBuilder()
      .insert()
      .into(tableName)
      .values(data)
      .returning('*')
      .execute();

    return result.generatedMaps;
  }

  async update<T extends Record<string, any>>(
    connection: DataSource,
    tableName: string,
    data: Partial<T>,
    conditions: Record<string, any>
  ) {
    const result = await connection.createQueryBuilder()
      .update(tableName)
      .set(data)
      .where(conditions)
      .returning('*')
      .execute();

    return result.generatedMaps;
  }

  async delete(
    connection: DataSource,
    tableName: string,
    conditions: Record<string, any>
  ) {
    const result = await connection.createQueryBuilder()
      .delete()
      .from(tableName)
      .where(conditions)
      .execute();

    return result.affected;
  }

  async query(
    connection: DataSource,
    tableName: string,
    conditions?: Record<string, any>,
    options?: {
      sort?: { field: string, direction: 'ASC' | 'DESC' }[],
      limit?: number,
      offset?: number
    }
  ) {
    let query = connection.createQueryBuilder()
      .select()
      .from(tableName, tableName);

    if (conditions) {
      Object.entries(conditions).forEach(([field, value]) => {
        if (Array.isArray(value)) {
          query = query.andWhere(`${field} IN (:...${field})`, { [field]: value });
        } else {
          query = query.andWhere(`${field} = :${field}`, { [field]: value });
        }
      });
    }

    if (options?.sort) {
      options.sort.forEach(sort => {
        query = query.addOrderBy(sort.field, sort.direction);
      });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query.getRawMany();
  }

  async createTenantDatabase(domain: string): Promise<{ url: string; password: string; id: string; }> {
    const dbDomain = Resource.App.stage + '-' + domain;

    const role = await neon.createProjectBranchRole(projectId, branchId, {
      role: {
        name: dbDomain,
      }
    });

    await wait(10000);

    const tenantDbDetails = await neon.createProjectBranchDatabase(projectId, branchId, {
      database: {
        name: dbDomain,
        owner_name: role.data.role.name,
      }
    });

    await wait(10000);

    const password = await neon.resetProjectBranchRolePassword(projectId, branchId, role.data.role.name, {});

    return {
      url: `postgresql://${role.data.role.name}:${password.data.role.password}@${endpoint}/${tenantDbDetails.data.database.name}?sslmode=require`,
      password: password.data.role.password || '',
      id: tenantDbDetails.data.database.id.toString(),
    };
  }

  async dropTenantDatabase(domain: string): Promise<void> {
    const connection = this.tenantConnections.get(domain);

    if (connection) {
      await connection.destroy();
      this.tenantConnections.delete(domain);
    }

    const dbDomain = Resource.App.stage + '-' + domain;

    const databases = await neon.listProjectBranchDatabases(projectId, branchId);

    const database = databases.data.databases.find(d => d.name === dbDomain);

    if (database) {
      await neon.deleteProjectBranchDatabase(projectId, branchId, database.name);
      await wait(10000);
    }

    const roles = await neon.listProjectBranchRoles(projectId, branchId);

    const role = roles.data.roles.find(r => r.name === dbDomain);

    if (role) {
      await neon.deleteProjectBranchRole(projectId, branchId, role.name);
      await wait(10000);
    }
  }

  async listTables(connection: DataSource): Promise<string[]> {
    const queryRunner = connection.createQueryRunner();
    const tables = await queryRunner.getTables();
    await queryRunner.release();
    return tables.map(table => table.name);
  }

  async getTableSchema(connection: DataSource, tableName: string): Promise<{
    name: string;
    columns: TableColumn[];
  }> {
    const queryRunner = connection.createQueryRunner();
    const table = await queryRunner.getTable(tableName);
    await queryRunner.release();

    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    return {
      name: table.name,
      columns: table.columns,
    };
  }
}