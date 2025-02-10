import { eq } from "drizzle-orm";
import { environments, tenantsDB } from "../models/tenants.sql";
import { Resource } from "sst";
import { Autowire, Injectable } from "ts-injection";
import { TENANTS_DB_TOKEN } from "../injector/tokens";

@Injectable()
export class EnvironmentsService {
  @Autowire(TENANTS_DB_TOKEN)
  private db: typeof tenantsDB

  async getCurrentEnvironment() {
    const [env] = await this.db.select().from(environments).where(eq(environments.name, Resource.App.stage)).limit(1).execute();

    return env;
  }
}

export type Environment = Awaited<ReturnType<EnvironmentsService['getCurrentEnvironment']>>;
