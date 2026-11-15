import { auth } from "../clients/auth.client";
import { DatabaseService } from "./database.service";
import { WebService } from "./web.service";
import { AbstractService } from "./service";
import { and, arrayContains, eq, isNull, not, or } from "drizzle-orm";
import { tenants } from "../entities/globals";
import { CreateTenant, Tenant } from "@repo/fintivio/schemas";
import { sleep } from "@repo/fintivio/utilities";
import { GLOBAL_CONNECTION } from "../injector/tokens/global-connection.token";
import { type GlobalDatabase } from "../clients/database.client";
import { Injectable, Inject, Scope } from "@nestjs/common";
import { ConnectionService } from "./connection.service";

@Injectable({
  scope: Scope.REQUEST
})
export class TenantsService extends AbstractService {
  constructor(
    @Inject(GLOBAL_CONNECTION) private db: GlobalDatabase,
    @Inject(ConnectionService) private databaseService: ConnectionService,
    @Inject(WebService) private webService: WebService,
  ) { super(); }

  async getContextualTenant() {
    const { tenant, domain } = await this.webService.getTenantAndDomain();

    let tenantObject = await this.getByDomain(domain!);

    if (!tenantObject && tenant) {
      tenantObject = await this.getByDomain(tenant);
    }

    if (!tenantObject && !domain!.includes('localhost')) {
      throw new Error('Tenant for current context not found')
    }

    return tenantObject
  }

  async create(data: CreateTenant) {
    const onError = [] as Array<() => Promise<void>>;
    try {
      const [existingTenant] = await this.db.select().from(tenants).where(eq(tenants.domain, data.domain)).limit(1).execute();

      if (existingTenant) {
        throw new Error("Tenant already exists");
      }

      // Create tenant database
      const { url: databaseUrl, password: databasePassword, id: databaseId } =
        await this.databaseService.createTenantDatabase(data.domain);

      onError.push(async () => {
        await this.databaseService.dropTenantDatabase(data.domain);
      });

      // Create descope tenant
      const baseDomain = process.env.BASE_DOMAIN!;
      await auth.management.tenant.createWithId(data.domain, data.name, [
        `${data.domain}.${baseDomain}`,
      ]);

      onError.push(async () => {
        await auth.management.tenant.delete(data.domain);
      });

      // Create tenant record
      const tenant = {
        ...data,
        databaseUrl,
        databasePassword,
        databaseId,
      } as unknown as Tenant;

      const [savedTenant] = await this.db.insert(tenants).values(tenant).returning().execute();

      onError.push(async () => {
        await this.db.delete(tenants).where(eq(tenants.domain, data.domain)).execute();
      });

      // Initialize tenant database with migrations
      try {
        // Wait a bit for the database to be ready
        await sleep(5000);

        await this.databaseService.getTenantConnection(
          data.domain,
          databaseUrl
        );

        // The migrations will be run automatically in getTenantConnection
        console.log(`Successfully initialized database for tenant ${data.domain}`);

        return savedTenant;
      } catch (error) {
        console.error(`Failed to initialize database for tenant ${data.domain}:`, error);
        throw error;
      }
    } catch (error) {
      console.error(error);

      for (const fn of onError.reverse()) {
        await fn();
      }

      throw error;
    }
  }

  async getByDomain(domain: string) {
    const [dom] = await this.db.select().from(tenants).where(
      or(
        eq(tenants.domain, domain),
        and(
          not(isNull(tenants.allowedDomains)),
          arrayContains(tenants.allowedDomains, [domain])
        )
      )
    ).limit(1).execute();

    return dom;
  }

  async getAllTenants() {
    return await this.db.select().from(tenants).execute();
  }

  async update(domain: string, data: Partial<Tenant>) {
    const tenant = await this.getByDomain(domain);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    Object.assign(tenant, data);
    const [updatedTenant] = await this.db.update(tenants).set(tenant).where(eq(tenants.domain, domain)).returning().execute();
    return updatedTenant;
  }

  async delete(domain: string) {
    const tenant = await this.getByDomain(domain);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    await auth.management.tenant.delete(tenant.domain);
    await this.databaseService.dropTenantDatabase(domain);
    await this.db.delete(tenants).where(eq(tenants.domain, domain)).execute();
  }

  async getPlatformDBClient(domain: string) {
    const tenant = await this.getByDomain(domain);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    return this.databaseService.getTenantConnection(
      domain,
      tenant.databaseUrl,
    );
  }
}