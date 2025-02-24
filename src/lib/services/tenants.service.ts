import { inject, injectable } from "tsyringe";
import { auth } from "../clients/auth.client";
import { Tenant } from "../entities/global/tenant.entity";
import { DataSource, Repository } from "typeorm";
import { GLOBAL_DB_TOKEN } from "../injector/tokens";
import { DatabaseService } from "./database.service";
import { wait } from "../utils";

@injectable()
export class TenantsService {
  private tenantRepository: Repository<Tenant>;

  constructor(
    @inject(GLOBAL_DB_TOKEN) private conn: DataSource,
    @inject(DatabaseService) private databaseService: DatabaseService
  ) {
    this.tenantRepository = this.conn.getRepository(Tenant);
  }

  async create(data: CreateTenant) {
    const onError = [] as Array<() => Promise<void>>;

    try {
      const existingTenant = await this.tenantRepository.findOne({
        where: { domain: data.domain }
      });

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
      const tenant = this.tenantRepository.create({
        ...data,
        databaseUrl,
        databasePassword,
        databaseId,
      });

      const savedTenant = await this.tenantRepository.save(tenant);

      onError.push(async () => {
        await this.tenantRepository.delete({ domain: data.domain });
      });

      // Initialize tenant database with migrations
      try {
        // Wait a bit for the database to be ready
        await wait(5000);
        
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
    return await this.tenantRepository
      .createQueryBuilder("tenant")
      .where("tenant.domain = :domain", { domain })
      .orWhere("(tenant.allowed_domains IS NOT NULL AND :domain = ANY(tenant.allowed_domains))", { domain })
      .getOne();
  }

  async getAllTenants() {
    return await this.tenantRepository.find();
  }

  async update(domain: string, data: Partial<Tenant>) {
    const tenant = await this.getByDomain(domain);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    Object.assign(tenant, data);
    return await this.tenantRepository.save(tenant);
  }

  async delete(domain: string) {
    const tenant = await this.getByDomain(domain);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    await auth.management.tenant.delete(tenant.domain);
    await this.databaseService.dropTenantDatabase(domain);
    await this.tenantRepository.delete({ domain });
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

export type CreateTenant = Omit<
  Tenant,
  'id' | 'databaseId' | 'databaseName' | 'databaseUrl' | 'databaseAuthToken' | 'createdAt' | 'updatedAt'
> & {
  invitee: Array<{ email: string; role: string }>;
};