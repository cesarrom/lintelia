import { eq } from "drizzle-orm";
import { tenants, tenantsDB } from "../models/tenants.sql";
import { auth } from "../clients/auth.client";
import { turso } from "../clients/turso.client";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

export class TenantsService {
  db: typeof tenantsDB;

  constructor(db: typeof tenantsDB) {
    this.db = db;
  }

  async create(data: typeof tenants.$inferInsert) {
    // isolated database for this company
    const tenantDbDetails = await turso.databases.create(data.domain);

    const token = await turso.databases.createToken(tenantDbDetails.name, {
      'authorization': 'full-access',
    })

    // descope tenant for this company, it will be tied to the subdomain
    const baseDomain = process.env.BASE_DOMAIN!;
    await auth.management.tenant.createWithId(data.domain, data.name, [
      `${data.domain}.${baseDomain}`,
    ]);

    // update the tenant with the database details
    data.databaseId = tenantDbDetails.id;
    data.databaseUrl = `libsql://${data.domain}-fintivio.turso.io`;
    data.databaseAuthToken = token.jwt;

    const [tenant] = await this.db.insert(tenants).values(data).returning();

    return tenant;
  }

  async getByDomain(domain: string) {
    return await this.db.select().from(tenants).where(eq(tenants.domain, domain)).limit(1).then((res) => res[0] || null);
  }

  async update(domain: number, data: Omit<Partial<typeof tenants.$inferInsert>, 'domain' | 'databaseId' | 'databaseName' | 'databaseUrl' | 'databaseAuthToken'>) {
    return await this.db.update(tenants).set(data).where(eq(tenants.domain, domain)).returning();
  }

  async delete(domain: string) {
    const tenant = await this.getByDomain(domain);

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    await turso.databases.delete(tenant.databaseName);
    await auth.management.tenant.delete(tenant.domain);

    return await this.db.delete(tenants).where(eq(tenants.domain, domain)).returning();
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

