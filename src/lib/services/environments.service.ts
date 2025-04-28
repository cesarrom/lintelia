import { injectable, inject } from 'tsyringe';
import { Environment } from "../entities";
import { Repository } from "typeorm";
import { Resource } from "sst";
import { DatabaseService } from "./database.service";
import { env } from '../constants';
import assert from 'assert';
import { Service } from './service';

@injectable()
export class EnvironmentsService extends Service {
  private static environmentRepository: Repository<Environment>;

  get env() {
    return env;
  }

  static dependencies() {
    return [
      DatabaseService
    ]
  }

  constructor(
    @inject(DatabaseService) private databaseService: DatabaseService
  ) {
    super();
  }

  async getEnvironmentRepository(): Promise<Repository<Environment>> {
    if (EnvironmentsService.environmentRepository) {
      return EnvironmentsService.environmentRepository;
    }

    const conn = await this.databaseService.getGlobalConnection();
    EnvironmentsService.environmentRepository = conn.getRepository(Environment);
    return EnvironmentsService.environmentRepository;
  }

  async getCurrentEnvironment(): Promise<Environment | null> {
    const environmentRepository = await this.getEnvironmentRepository();
    return await environmentRepository.findOne({
      where: { name: Resource.App.stage }
    });
  }

  async getDistributionId() {
    if (Resource.App.stage === 'local') {
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
    const environmentRepository = await this.getEnvironmentRepository();
    return await environmentRepository.findOne({
      where: { name }
    });
  }

  async listEnvironments(): Promise<Environment[]> {
    const environmentRepository = await this.getEnvironmentRepository();
    return await environmentRepository.find();
  }

  async createEnvironment(name: string, distributionArn: string): Promise<Environment> {
    const environment = new Environment();
    environment.name = name;
    environment.distributionArn = distributionArn;

    const environmentRepository = await this.getEnvironmentRepository();
    return await environmentRepository.save(environment);
  }

  async updateEnvironment(name: string, distributionArn: string): Promise<Environment> {
    const environment = await this.getEnvironmentByName(name);
    if (!environment) {
      throw new Error("Environment not found");
    }

    environment.distributionArn = distributionArn;
    const environmentRepository = await this.getEnvironmentRepository();
    return await environmentRepository.save(environment);
  }

  async deleteEnvironment(name: string): Promise<void> {
    const environment = await this.getEnvironmentByName(name);
    if (!environment) {
      throw new Error("Environment not found");
    }

    const environmentRepository = await this.getEnvironmentRepository();
    await environmentRepository.remove(environment);
  }
}