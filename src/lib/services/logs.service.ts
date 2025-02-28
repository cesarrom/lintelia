import { inject, injectable } from "tsyringe";
import { DataSource, Repository, Between, FindOptionsWhere } from "typeorm";
import { TENANT_DB_TOKEN } from "../injector/tokens";
import { Log, LogLevel, LogCategory } from "../entities/tenant/log.entity";

export interface CreateLogInput {
  message: string;
  details?: string;
  level?: LogLevel;
  category?: LogCategory;
  source?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface LogsFilter {
  startDate?: Date;
  endDate?: Date;
  level?: LogLevel;
  category?: LogCategory;
  source?: string;
  userId?: string;
  acknowledged?: boolean;
  search?: string;
}

@injectable()
export class LogsService {
  private repository: Repository<Log>;

  constructor(
    @inject(TENANT_DB_TOKEN) private conn: DataSource,
  ) {
    this.repository = this.conn.getRepository(Log);
  }

  async create(data: CreateLogInput): Promise<Log> {
    const log = this.repository.create(data);
    return await this.repository.save(log);
  }

  async list(filter?: LogsFilter): Promise<Log[]> {
    const where: FindOptionsWhere<Log> = {};

    if (filter?.startDate && filter?.endDate) {
      where.createdAt = Between(filter.startDate, filter.endDate);
    }

    if (filter?.level) {
      where.level = filter.level;
    }

    if (filter?.category) {
      where.category = filter.category;
    }

    if (filter?.source) {
      where.source = filter.source;
    }

    if (filter?.userId) {
      where.userId = filter.userId;
    }

    if (filter?.acknowledged !== undefined) {
      where.acknowledged = filter.acknowledged;
    }

    if (filter?.search) {
      where.message = filter.search;
    }

    return await this.repository.find({
      where,
      order: {
        createdAt: 'DESC'
      }
    });
  }

  async getById(id: string): Promise<Log | null> {
    return await this.repository.findOneBy({ id });
  }

  async acknowledge(id: string, userId: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      acknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: new Date()
    });
    return result.affected ? result.affected > 0 : false;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return result.affected ? result.affected > 0 : false;
  }

  async deleteOlderThan(date: Date): Promise<boolean> {
    const result = await this.repository.delete({
      createdAt: Between(new Date(0), date)
    });
    return result.affected ? result.affected > 0 : false;
  }

  // Helper methods for common logging scenarios
  async info(message: string, details?: Partial<CreateLogInput>): Promise<Log> {
    return this.create({
      message,
      level: 'info',
      ...details
    });
  }

  async warning(message: string, details?: Partial<CreateLogInput>): Promise<Log> {
    return this.create({
      message,
      level: 'warning',
      ...details
    });
  }

  async error(message: string, details?: Partial<CreateLogInput>): Promise<Log> {
    return this.create({
      message,
      level: 'error',
      ...details
    });
  }

  async debug(message: string, details?: Partial<CreateLogInput>): Promise<Log> {
    return this.create({
      message,
      level: 'debug',
      ...details
    });
  }
} 