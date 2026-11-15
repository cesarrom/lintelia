import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { RestateService } from "./restate.abstract.service";
import { LogsService } from "../../services/logs.service";
import { Inject, Scope, Injectable } from "@nestjs/common";
import { AcknowledgeLogRequest, CreateLogRequest, LogsFilterRequest } from "@repo/fintivio/schemas";

@Injectable({
  scope: Scope.REQUEST
})
export class LogService extends RestateService<'logs'> {
  object = object({
    name: "logs",
    handlers: {
      // List logs with optional filtering
      getLogs: async (c: ObjectContext, filter?: LogsFilterRequest) => {
        const logs = await this.logsService.list(filter);

        return logs.map(log => ({ ...log }))
      },

      // Get a single log by ID
      getLog: async (c: ObjectContext, id: string) => {
        const log = await this.logsService.getById(id);
        return { ...log };
      },

      // Create a new log entry
      createLog: async (c: ObjectContext, data: CreateLogRequest) => {
        const log = await this.logsService.create(data);

        return { ...log };
      },

      // Acknowledge a log
      acknowledgeLog: async (c: ObjectContext, { id, userId }: AcknowledgeLogRequest) => {
        const success = await this.logsService.acknowledge(id, userId);

        return success;
      },

      // Delete a log
      deleteLog: async (c: ObjectContext, id: string) => {
        const success = await this.logsService.delete(id);

        return success;
      },

      // Delete logs older than a specific date
      deleteOldLogs: async (c: ObjectContext, date: Date) => {
        const success = await this.logsService.deleteOlderThan(date);

        return success;
      },

      // Get logs analytics
      getLogsAnalytics: async (c: ObjectContext, filter?: LogsFilterRequest) => {
        const analytics = await this.logsService.getAnalytics(filter);
        return JSON.parse(JSON.stringify(analytics));
      },

      // Get top users by log count
      getTopUsers: async (c: ObjectContext, limit: number = 10) => {
        const topUsers = await this.logsService.getTopUsers(limit);
        return JSON.parse(JSON.stringify(topUsers));
      },

      // Get top sources by log count
      getTopSources: async (c: ObjectContext, limit: number = 10) => {
        const topSources = await this.logsService.getTopSources(limit);
        return JSON.parse(JSON.stringify(topSources));
      },

      // Get logs trend over time
      getLogsTrend: async (c: ObjectContext, days: number = 30) => {
        const trend = await this.logsService.getLogsTrend(days);
        return JSON.parse(JSON.stringify(trend));
      },
    },
  });

  constructor(
    @Inject(LogsService) private logsService: LogsService,

  ) {
    super();
  }
}
