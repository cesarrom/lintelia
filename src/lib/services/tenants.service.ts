import { inject, injectable } from "tsyringe";
import { auth } from "../clients/auth.client";
import { Tenant } from "../entities";
import { Repository } from "typeorm";
import { DatabaseService } from "./database.service";
import { wait } from "../utils";
import { WebService } from "./web.service";
import assert from "assert";
import { Service } from "./service";

@injectable()
export class TenantsService extends Service {
  private tenantRepository: Repository<Tenant> | null = null;
  private cachedTenant: Tenant | null = null;

  static dependencies() {
    return [
      DatabaseService,
      WebService,
    ]
  }

  constructor(
    @inject(DatabaseService) private databaseService: DatabaseService,
    @inject(WebService) private webService: WebService,
  ) { super(); }

  async getRepository() {
    if (this.tenantRepository) {
      return this.tenantRepository;
    }

    const conn = await this.databaseService.getGlobalConnection();
    this.tenantRepository = conn.getRepository(Tenant);
    return this.tenantRepository;
  }

  async getContextualTenant() {
    const { tenant, domain } = await this.webService.getTenantAndDomain();

    let tenantObject = await this.getByDomain(domain);

    if (!tenantObject && tenant) {
      tenantObject = await this.getByDomain(tenant);
    }

    if (!tenantObject && !domain.includes('localhost')) {
      throw new Error('Tenant for current context not found')
    }

    return tenantObject
  }

  async create(data: CreateTenant) {
    const onError = [] as Array<() => Promise<void>>;
    const repository = await this.getRepository();
    try {
      const existingTenant = await repository.findOne({
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
      const tenant = repository.create({
        ...data,
        databaseUrl,
        databasePassword,
        databaseId,
      });

      const savedTenant = await repository.save(tenant);

      onError.push(async () => {
        await repository.delete({ domain: data.domain });
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
    const repository = await this.getRepository();
    return await repository
      .createQueryBuilder("tenant")
      .where("tenant.domain = :domain", { domain })
      .orWhere("(tenant.allowed_domains IS NOT NULL AND :domain = ANY(tenant.allowed_domains))", { domain })
      .getOne();
  }

  async getAllTenants() {
    const repository = await this.getRepository();
    return await repository.find();
  }

  async update(domain: string, data: Partial<Tenant>) {
    const repository = await this.getRepository();
    const tenant = await this.getByDomain(domain);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    Object.assign(tenant, data);
    return await repository.save(tenant);
  }

  async delete(domain: string) {
    const repository = await this.getRepository();
    const tenant = await this.getByDomain(domain);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    await auth.management.tenant.delete(tenant.domain);
    await this.databaseService.dropTenantDatabase(domain);
    await repository.delete({ domain });
  }

  async getContextualPlatformDBClient() {
    const domain = await this.getCachedDomainFromTenant();
    return this.getPlatformDBClient(domain);
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

  async getCachedTenant() {
    if (this.cachedTenant) {
      return this.cachedTenant;
    }
    this.cachedTenant = await this.getContextualTenant();
    return this.cachedTenant;
  }

  async getCachedDomainFromTenant() {
    const tenant = await this.getCachedTenant();
    assert(tenant, 'Tenant not found');
    return tenant.domain;
  }
}

export type CreateTenant = Omit<
  Tenant,
  'id' | 'databaseId' | 'databaseName' | 'databaseUrl' | 'databaseAuthToken' | 'createdAt' | 'updatedAt'
> & {
  invitee: Array<{ email: string; role: string }>;
};