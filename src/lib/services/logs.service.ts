import { inject, injectable } from "tsyringe";
import { DataSource, Repository, Between, FindOptionsWhere, MoreThanOrEqual, LessThanOrEqual, Like, ILike } from "typeorm";
import { TENANT_DB_TOKEN, USER_TOKEN } from "../injector/tokens";
import { Log, LogLevel, LogCategory } from "../entities/tenant/log.entity";
import { User } from "@/types/auth";
import { SystemTriggersService } from "./system-triggers.service";

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

export interface LogsAnalytics {
  totalCount: number;
  byLevel: Record<LogLevel, number>;
  byCategory: Record<LogCategory, number>;
  bySource: Record<string, number>;
  byUser: Record<string, number>;
  timeDistribution: Array<{
    date: string;
    count: number;
    byLevel: Record<LogLevel, number>;
  }>;
  topErrors: Log[];
  recentActivity: Log[];
}

@injectable()
export class LogsService {
  private repository: Repository<Log>;

  constructor(
    @inject(TENANT_DB_TOKEN) private conn: DataSource,
    @inject(SystemTriggersService) private systemTriggersService: SystemTriggersService,
    @inject(USER_TOKEN) private user: User | null
  ) {
    this.repository = this.conn.getRepository(Log);
  }

  async create(data: CreateLogInput): Promise<Log> {
    // If userId is not provided but we have a logged-in user, use their email
    const logData = {
      ...data,
      userId: data.userId || this.user?.email
    };
    
    const log = this.repository.create(logData);
    const savedLog = await this.repository.save(log);

    setImmediate(() => this.systemTriggersService.processLog(savedLog));

    return savedLog;
  }

  async list(filter?: LogsFilter): Promise<Log[]> {
    const where: FindOptionsWhere<Log> = {};

    if (filter?.startDate && filter?.endDate) {
      where.createdAt = Between(filter.startDate, filter.endDate);
    } else if (filter?.startDate) {
      where.createdAt = MoreThanOrEqual(filter.startDate);
    } else if (filter?.endDate) {
      where.createdAt = LessThanOrEqual(filter.endDate);
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
      where.message = ILike(`%${filter.search}%`);
      where.details = ILike(`%${filter.search}%`);
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

  // Analytics methods
  async getAnalytics(filter?: LogsFilter): Promise<LogsAnalytics> {
    // Get logs based on filter
    const logs = await this.list(filter);
    
    // Calculate total count
    const totalCount = logs.length;
    
    // Initialize counters
    const byLevel: Record<LogLevel, number> = {
      info: 0,
      warning: 0,
      error: 0,
      debug: 0
    };
    
    const byCategory: Record<LogCategory, number> = {
      system: 0,
      workflow: 0,
      user: 0,
      form: 0,
      security: 0,
      integration: 0,
      review: 0,
      database: 0
    };
    
    const bySource: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    
    // Group logs by date for time distribution
    const logsByDate: Record<string, {
      count: number;
      byLevel: Record<LogLevel, number>;
    }> = {};
    
    // Process each log
    logs.forEach(log => {
      // Count by level
      byLevel[log.level]++;
      
      // Count by category
      byCategory[log.category]++;
      
      // Count by source
      const source = log.source || 'unknown';
      bySource[source] = (bySource[source] || 0) + 1;
      
      // Count by user
      if (log.userId) {
        byUser[log.userId] = (byUser[log.userId] || 0) + 1;
      }
      
      // Group by date for time distribution
      const dateStr = new Date(log.createdAt).toISOString().split('T')[0];
      if (!logsByDate[dateStr]) {
        logsByDate[dateStr] = {
          count: 0,
          byLevel: { info: 0, warning: 0, error: 0, debug: 0 }
        };
      }
      logsByDate[dateStr].count++;
      logsByDate[dateStr].byLevel[log.level]++;
    });
    
    // Convert logsByDate to array and sort by date
    const timeDistribution = Object.entries(logsByDate).map(([date, data]) => ({
      date,
      count: data.count,
      byLevel: data.byLevel
    })).sort((a, b) => a.date.localeCompare(b.date));
    
    // Get top errors
    const topErrors = logs
      .filter(log => log.level === 'error')
      .slice(0, 5);
    
    // Get recent activity
    const recentActivity = logs.slice(0, 10);
    
    return {
      totalCount,
      byLevel,
      byCategory,
      bySource,
      byUser,
      timeDistribution,
      topErrors,
      recentActivity
    };
  }

  async getTopUsers(limit: number = 10): Promise<Array<{ userId: string; count: number }>> {
    const result = await this.repository
      .createQueryBuilder('log')
      .select('log.userId, COUNT(*) as count')
      .where('log.userId IS NOT NULL')
      .groupBy('log.userId')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();
    
    return result.map(item => ({
      userId: item.userId,
      count: parseInt(item.count)
    }));
  }

  async getTopSources(limit: number = 10): Promise<Array<{ source: string; count: number }>> {
    const result = await this.repository
      .createQueryBuilder('log')
      .select('log.source, COUNT(*) as count')
      .where('log.source IS NOT NULL')
      .groupBy('log.source')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();
    
    return result.map(item => ({
      source: item.source,
      count: parseInt(item.count)
    }));
  }

  async getLogsTrend(days: number = 30): Promise<Array<{ date: string; count: number; byLevel: Record<LogLevel, number> }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const logs = await this.repository.find({
      where: {
        createdAt: MoreThanOrEqual(startDate)
      }
    });
    
    // Group logs by date
    const logsByDate: Record<string, {
      count: number;
      byLevel: Record<LogLevel, number>;
    }> = {};
    
    // Initialize all dates in the range
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      logsByDate[dateStr] = {
        count: 0,
        byLevel: { info: 0, warning: 0, error: 0, debug: 0 }
      };
    }
    
    // Fill in actual log counts
    logs.forEach(log => {
      const dateStr = new Date(log.createdAt).toISOString().split('T')[0];
      if (logsByDate[dateStr]) {
        logsByDate[dateStr].count++;
        logsByDate[dateStr].byLevel[log.level]++;
      }
    });
    
    // Convert to array and sort by date
    return Object.entries(logsByDate).map(([date, data]) => ({
      date,
      count: data.count,
      byLevel: data.byLevel
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  // Helper methods for common logging scenarios
  async info(message: string, details?: Partial<CreateLogInput>): Promise<Log> {
    return this.create({
      message,
      level: 'info',
      userId: this.user?.email, // Include user email if available
      ...details
    });
  }

  async warning(message: string, details?: Partial<CreateLogInput>): Promise<Log> {
    return this.create({
      message,
      level: 'warning',
      userId: this.user?.email, // Include user email if available
      ...details
    });
  }

  async error(message: string, details?: Partial<CreateLogInput>): Promise<Log> {
    return this.create({
      message,
      level: 'error',
      userId: this.user?.email, // Include user email if available
      ...details
    });
  }

  async debug(message: string, details?: Partial<CreateLogInput>): Promise<Log> {
    return this.create({
      message,
      level: 'debug',
      userId: this.user?.email, // Include user email if available
      ...details
    });
  }
} 