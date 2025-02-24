import { injectable, inject } from 'tsyringe';
import { Environment } from "../entities/global/environment.entity";
import { Repository } from "typeorm";
import { Resource } from "sst";
import { DatabaseService } from "./database.service";

@injectable()
export class EnvironmentsService {
  private static environmentRepository: Repository<Environment>;

  constructor(
    @inject(DatabaseService) private databaseService: DatabaseService
  ) {}

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

export type { Environment } from "../entities/global/environment.entity";
