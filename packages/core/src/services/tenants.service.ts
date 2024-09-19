import { eq, or, sql } from "drizzle-orm";
import { tenants, tenantsDB } from "../models/tenants.sql";
import { auth } from "../clients/auth.client";
import { turso } from "../clients/turso.client";
import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import { DomainsService } from "./domains.service";
import { env } from "../constants";
import { TENANTS_DB_TOKEN } from "../libs/injector/tokens";
import { Autowire, Injectable } from "ts-injection";

@Injectable()
export class TenantsService {

  @Autowire(TENANTS_DB_TOKEN)
  private db: typeof tenantsDB;

  @Autowire(DomainsService)
  private domainService: DomainsService

  async create(dataRef: CreateTenant) {
    const onError = [] as Array<() => Promise<void>>;
    const data: Partial<typeof tenants.$inferInsert> = dataRef;
    try {
      // isolated database for this company
      const tenantDbDetails = await turso.databases.create(data.domain, {
        group: env.DATABASE_GROUP_NAME,
        schema: env.DATABASE_NAME,
      });

      onError.push(async () => {
        await turso.databases.delete(tenantDbDetails.name);
      });

      const token = await turso.databases.createToken(tenantDbDetails.name, {
        'authorization': 'full-access',
      });

      // descope tenant for this company, it will be tied to the subdomain
      const baseDomain = process.env.BASE_DOMAIN!;
      await auth.management.tenant.createWithId(data.domain, data.name, [
        `${data.domain}.${baseDomain}`,
      ]);

      onError.push(async () => {
        await auth.management.tenant.delete(data.domain);
      });

      // update the tenant with the database details
      data.databaseName = tenantDbDetails.name;
      data.databaseId = tenantDbDetails.id;
      data.databaseUrl = `libsql://${data.domain}-fintivio.turso.io`;
      data.databaseAuthToken = token.jwt;

      const existingTenants = await this.db.select().from(tenants).where(eq(tenants.domain, data.domain)).limit(1);

      if (existingTenants.length > 0) {
        // DELETE
        await this.db.delete(tenants).where(eq(tenants.domain, data.domain));
      }

      const [tenant] = await this.db.insert(tenants).values(data as typeof tenants.$inferInsert).returning();

      onError.push(async () => {
        await this.db.delete(tenants).where(eq(tenants.domain, data.domain));
      });

      //const isAlias = env.DOMAIN.includes('fintivio');

      /*await this.domainService.createSubdomain(tenant.domain, env.DOMAIN, isAlias);

      onError.push(async () => {
        await this.domainService.deleteSubdomain(tenant.domain, env.DOMAIN, isAlias);
      });*/

      return tenant;
    } catch (error) {
      console.error(error);

      for (const fn of onError.reverse()) {
        await fn();
      }

      throw error;
    }
  }

  async getByDomain(domain: string) {
    return await this.db.select().from(tenants).where
      (or(
        eq(tenants.domain, domain),
        // POSTGRES:: tenants.allowedDomains is a jsonb column that contains an array of strings
        sql`${tenants.allowedDomains}::jsonb @> jsonb_build_array(${domain})`)
      ).limit(1).then((res) => res[0] || null);
  }

  async update(domain: string, data: Omit<Partial<typeof tenants.$inferInsert>, 'domain' | 'databaseId' | 'databaseName' | 'databaseUrl' | 'databaseAuthToken'>) {
    return await this.db.update(tenants).set(data).where(eq(tenants.domain, domain)).returning();
  }

  async delete(domain: string) {
    const tenant = await this.getByDomain(domain);

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const isAlias = env.DOMAIN.includes('fintivio');


    await auth.management.tenant.delete(tenant.domain);
    await turso.databases.delete(tenant.databaseName);
    await this.domainService.deleteSubdomain(tenant.domain, env.DOMAIN, isAlias);
    await this.db.delete(tenants).where(eq(tenants.domain, domain)).returning();

  }

  async getPlatformDBClient(domain: string) {
    const tenant = await this.getByDomain(domain);

    const turso = createClient({
      url: tenant.databaseUrl,
      authToken: tenant.databaseAuthToken,
    });

    const db = drizzle(turso);

    return db;
  }
}

export type PlatformDB = Awaited<ReturnType<TenantsService['getPlatformDBClient']>>;

export type CreateTenant = Omit<typeof tenants.$inferInsert,
  'id' |
  'databaseId' |
  'databaseName' |
  'databaseUrl' |
  'databaseAuthToken' |
  'allowedDomains'
> & {
  pallette: {
    primary: string,
    secondary: string,
    accent: string,
  },
  invitee: Array<{ email: string, role: string }>;
  allowedDomains: string[];
};