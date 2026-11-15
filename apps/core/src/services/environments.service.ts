import { type AppEnvironment } from '../constants';
import assert from 'assert';
import { AbstractService } from './service';
import { eq } from 'drizzle-orm';
import { Environment } from '@repo/fintivio/schemas';
import { ENV } from '../injector/tokens/env.token';
import { GLOBAL_CONNECTION } from '../injector/tokens/global-connection.token';
import { type GlobalDatabase } from '../clients/database.client';
import { Injectable, Inject, Scope } from "@nestjs/common";
import { environments } from '../entities/globals';

@Injectable({
  scope: Scope.DEFAULT
})
export class EnvironmentsService extends AbstractService {
  constructor(
    @Inject(ENV) private env: AppEnvironment,
    @Inject(GLOBAL_CONNECTION) private db: GlobalDatabase
  ) {
    super();
  }

  async getCurrentEnvironment(): Promise<Environment | null> {
    const [result] = await this.db.select().from(environments).where(eq(environments.name, this.env.NODE_ENV)).execute();
    return result;
  }

  async getDistributionId() {
    if (this.env.NODE_ENV === 'local') {
      return '';
    }

    const resultArn = await this.getCurrentEnvironment();

    assert(resultArn?.distributionArn, 'Distribution ARN is required');

    const { distributionArn } = resultArn;

    const distributionId = distributionArn.split("/").pop();

    assert(distributionId, 'Distribution ID is required');

    return distributionId
  }

  async getEnvironmentByName(name: string): Promise<Environment | null> {
    const [result] = await this.db.select().from(environments).where(eq(environments.name, name)).execute();
    return result;
  }

  async listEnvironments(): Promise<Environment[]> {
    const results = await this.db.select().from(environments).execute();
    return results;
  }

  async createEnvironment(name: string, distributionArn: string): Promise<Environment> {
    const environment = {
      name,
      distributionArn,
    };

    const [result] = await this.db.insert(environments).values(environment).returning().execute();
    
    return result;
  }

  async updateEnvironment(name: string, distributionArn: string): Promise<Environment> {
    const environment = await this.getEnvironmentByName(name);
    if (!environment) {
      throw new Error("Environment not found");
    }

    environment.distributionArn = distributionArn;
    const [updatedEnvironment] = await this.db.update(environments).set(environment).where(eq(environments.name, name)).returning().execute();

    return updatedEnvironment;
  }

  async deleteEnvironment(name: string): Promise<void> {
    const environment = await this.getEnvironmentByName(name);
    if (!environment) {
      throw new Error("Environment not found");
    }

    await this.db.delete(environments).where(eq(environments.name, name)).execute();
  }
}