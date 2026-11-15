import { sysLogs } from "../entities/tenants";
import { SystemTriggersService } from "./system-triggers.service";
import { AbstractService } from "./service";
import { desc, eq, lt, sql } from "drizzle-orm";
import { WebService } from "./web.service";
import { CreateLogRequest, Log, LogCategory, LogLevel, LogsAnalyticsResponse, LogsFilterRequest, LogTrendsResponse, TopSourceLogsResponse, TopUserLogsResponse } from "@repo/fintivio/schemas";
import { TENANT_CONNECTION } from "../injector/tokens/tenant-connection.token";
import { type TenantDatabase } from "../clients/database.client";
import { Injectable, Inject, Scope } from "@nestjs/common";


@Injectable({
  scope: Scope.REQUEST
})
export class LogsService extends AbstractService {
  constructor(
    @Inject(TENANT_CONNECTION) private db: TenantDatabase,
    @Inject(SystemTriggersService) private systemTriggersService: SystemTriggersService,
    @Inject(WebService) private webService: WebService,
  ) {
    super();
  }

  async justInsert(log: Log) {
    const [savedLog] = await this.db.insert(sysLogs).values(log).returning().execute();

    setImmediate(() => this.systemTriggersService.processLog(savedLog));

    return savedLog;
  }

  async create(data: CreateLogRequest): Promise<Log> {
    const user = await this.webService.getSessionUser()
    // If userId is not provided but we have a logged-in user, use their email
    const log = {
      ...data,
      userId: data.userId || user?.email || 'system',
    };

    return this.justInsert(log);
  }

  async list(filter?: LogsFilterRequest): Promise<Log[]> {
    let q = sql`1 = 1`

    if (filter?.startDate && filter?.endDate) {
      q = q.append(sql` AND ${sysLogs.createdAt} BETWEEN ${filter.startDate} AND ${filter.endDate}`)
    } else if (filter?.startDate) {
      q = q.append(sql` AND ${sysLogs.createdAt} >= ${filter.startDate}`)
    } else if (filter?.endDate) {
      q = q.append(sql` AND ${sysLogs.createdAt} <= ${filter.endDate}`)
    }

    if (filter?.level) {
      q = q.append(sql` AND ${sysLogs.level} = ${filter.level}`)
    }

    if (filter?.category) {
      q = q.append(sql` AND ${sysLogs.category} = ${filter.category}`)
    }

    if (filter?.source) {
      q = q.append(sql` AND ${sysLogs.source} = ${filter.source}`)
    }

    if (filter?.userId) {
      q = q.append(sql` AND ${sysLogs.userId} = ${filter.userId}`)
    }

    if (filter?.acknowledged !== undefined) {
      q = q.append(sql` AND ${sysLogs.acknowledged} = ${filter.acknowledged}`)
    }

    if (filter?.search) {
      q = q.append(sql` AND (${sysLogs.message} LIKE '%${filter.search}%' OR ${sysLogs.details} LIKE '%${filter.search}%')`);
    }



    const result = await this.db.select().from(sysLogs).where(q).orderBy(desc(sysLogs.createdAt)).execute();

    return result;
  }

  async getById(id: string): Promise<Log | null> {
    const [result] = await this.db.select().from(sysLogs).where(eq(sysLogs.id, id)).execute()
    return result;
  }

  async acknowledge(id: string, userId: string): Promise<boolean> {
    const { length: affected } = await this.db.update(sysLogs).set({
      acknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: new Date()
    }).where(eq(sysLogs.id, id)).returning().execute();

    return affected > 0;
  }

  async delete(id: string): Promise<boolean> {
    const { length: affected } = await this.db.delete(sysLogs).where(eq(sysLogs.id, id)).returning().execute()
    return affected > 0;
  }

  async deleteOlderThan(date: Date): Promise<boolean> {
    const { length: affected } = await this.db.delete(sysLogs).where(lt(sysLogs.createdAt, date)).returning().execute()
    return affected > 0;
  }

  // Analytics methods
  async getAnalytics(filter?: LogsFilterRequest): Promise<LogsAnalyticsResponse> {
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
      byLevel[log.level!]++;

      // Count by category
      byCategory[log.category!]++;

      // Count by source
      const source = log.source || 'unknown';
      bySource[source] = (bySource[source] || 0) + 1;

      // Count by user
      if (log.userId) {
        byUser[log.userId] = (byUser[log.userId] || 0) + 1;
      }

      // Group by date for time distribution
      const dateStr = new Date(log.createdAt!).toISOString().split('T')[0];
      if (!logsByDate[dateStr]) {
        logsByDate[dateStr] = {
          count: 0,
          byLevel: { info: 0, warning: 0, error: 0, debug: 0 }
        };
      }
      logsByDate[dateStr].count++;
      logsByDate[dateStr].byLevel[log.level!]++;
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

  async getTopUsers(limit: number = 10): Promise<Array<TopUserLogsResponse>> {
    const result = await this.db.execute<{ userId: string; count: number }>(sql`SELECT ${sysLogs.userId}, COUNT(*) as count FROM ${sysLogs} WHERE ${sysLogs.userId} IS NOT NULL GROUP BY ${sysLogs.userId} ORDER BY count DESC LIMIT ${limit}` as any);

    return result.map(item => ({
      userId: item.userId,
      count: parseInt(String(item.count))
    }));
  }

  async getTopSources(limit: number = 10): Promise<Array<TopSourceLogsResponse>> {
    const result = await this.db.execute<{ source: string; count: number }>(sql`SELECT ${sysLogs.source}, COUNT(*) as count FROM ${sysLogs} WHERE ${sysLogs.source} IS NOT NULL GROUP BY ${sysLogs.source} ORDER BY count DESC LIMIT ${limit}` as any);

    return result.map(item => ({
      source: item.source,
      count: parseInt(String(item.count))
    }));
  }

  async getLogsTrend(days: number = 30): Promise<Array<LogTrendsResponse>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Create an array of dates for the last N days
    const dateRange = Array.from({ length: days + 1 }, (_, i) => {
      const date = new Date(startDate.getTime());
      date.setDate(date.getDate() + i);
      return date.toISOString().split('T')[0];
    });
    
    // Query with date aggregation
    const result = await this.db.execute<{
      date: string;
      level: LogLevel;
      count: string;
    }>(sql`
      SELECT 
        DATE(${sysLogs.createdAt}) as date, 
        ${sysLogs.level} as level, 
        COUNT(*) as count 
      FROM ${sysLogs} 
      WHERE ${sysLogs.createdAt} >= ${startDate}
      GROUP BY DATE(${sysLogs.createdAt}), ${sysLogs.level}
      ORDER BY date
    ` as any);
    
    // Create a map of results by date
    const logsByDate: Record<string, { count: number; byLevel: Record<LogLevel, number> }> = {};
    
    // Initialize all dates with zero counts
    for (const dateStr of dateRange) {
      logsByDate[dateStr] = {
        count: 0,
        byLevel: { info: 0, warning: 0, error: 0, debug: 0 }
      };
    }
    
    // Fill in the actual counts from query results
    for (const row of result) {
      const dateStr = row.date;
      if (logsByDate[dateStr]) {
        const count = parseInt(String(row.count));
        logsByDate[dateStr].count += count;
        logsByDate[dateStr].byLevel[row.level] += count;
      }
    }
    
    // Convert to array format
    return Object.entries(logsByDate).map(([date, data]) => ({
      date,
      count: data.count,
      byLevel: data.byLevel
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  // Helper methods for common logging scenarios
  async info(message: string, details?: Partial<CreateLogRequest>): Promise<Log> {
    const user = await this.webService.getSessionUser();
    return this.create({
      message,
      level: 'info',
      userId: user?.email, // Include user email if available
      ...details
    });
  }

  async warning(message: string, details?: Partial<CreateLogRequest>): Promise<Log> {
    const user = await this.webService.getSessionUser();
    return this.create({
      message,
      level: 'warning',
      userId: user?.email, // Include user email if available
      ...details
    });
  }

  async error(message: string, details?: Partial<CreateLogRequest>): Promise<Log> {
    const user = await this.webService.getSessionUser();
    return this.create({
      message,
      level: 'error',
      userId: user?.email, // Include user email if available
      ...details
    });
  }

  async debug(message: string, details?: Partial<CreateLogRequest>): Promise<Log> {
    const user = await this.webService.getSessionUser();
    return this.create({
      message,
      level: 'debug',
      userId: user?.email, // Include user email if available
      ...details
    });
  }
} 