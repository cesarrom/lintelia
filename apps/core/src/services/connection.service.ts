import { AbstractService } from './service';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { GlobalDatabase, globalDatabase, TenantDatabase, tenantDatabase } from '../clients/database.client';
import { join } from 'path';
import { Injectable, Scope } from "@nestjs/common";
import { env } from '../constants';
import { branchId, endpoint, neon, projectId } from '../clients/neon.client';
import { sleep } from '@repo/fintivio/utilities';

@Injectable({
  scope: Scope.DEFAULT
})
export class ConnectionService extends AbstractService {
  private static globalConnection: GlobalDatabase | null = null;
  private tenantConnections: Map<string, TenantDatabase> = new Map();

  async getGlobalConnection() {
    if (!ConnectionService.globalConnection) {
      // DatabaseService.globalConnection = new DataSource(config);
      ConnectionService.globalConnection = globalDatabase();

      await migrate(ConnectionService.globalConnection, {
        'migrationsFolder': join(process.cwd(), 'drizzle-global')
      });
    }
    return ConnectionService.globalConnection;
  }

  async getTenantConnection(domain: string, url: string) {
    if (!this.tenantConnections.has(domain)) {
      try {
        const dbUrl = new URL(url);
        const connection = tenantDatabase(dbUrl.toString());

        try {
          await migrate(connection, {
            'migrationsFolder': join(process.cwd(), 'drizzle-tenant')
          });
        } catch (error) {
          console.error(`Failed to run migrations for tenant ${domain}:`, error);
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

  async createTenantDatabase(domain: string): Promise<{ url: string; password: string; id: string; }> {
      const dbDomain = env.NODE_ENV + '-' + domain;
  
      const role = await neon.createProjectBranchRole(projectId, branchId, {
        role: {
          name: dbDomain,
        }
      });
  
      await sleep(10000);
  
      const tenantDbDetails = await neon.createProjectBranchDatabase(projectId, branchId, {
        database: {
          name: dbDomain,
          owner_name: role.data.role.name,
        }
      });
  
      await sleep(10000);
  
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
        this.tenantConnections.delete(domain);
      }
  
      const dbDomain = env.NODE_ENV + '-' + domain;
  
      const databases = await neon.listProjectBranchDatabases(projectId, branchId);
  
      const database = databases.data.databases.find(d => d.name === dbDomain);
  
      if (database) {
        await neon.deleteProjectBranchDatabase(projectId, branchId, database.name);
        await sleep(10000);
      }
  
      const roles = await neon.listProjectBranchRoles(projectId, branchId);
  
      const role = roles.data.roles.find(r => r.name === dbDomain);
  
      if (role) {
        await neon.deleteProjectBranchRole(projectId, branchId, role.name);
        await sleep(10000);
      }
    }
}