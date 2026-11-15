import { LogsService } from "../services/logs.service";
import { Scope, Inject, Controller, Get, Post, Patch, Req, Res, type RawBodyRequest, Param } from "@nestjs/common";
import type { HonoRequest } from "hono/request";
import type { Context } from "hono";
import { LogCategory, LogLevel, type AcknowledgeLogRequest, type CreateLogRequest, type LogsFilterRequest } from "@repo/fintivio/schemas";
import assert from 'assert';
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";

@Controller({
  path: '/logs',
  scope: Scope.REQUEST
})
export class LogHandler {
  constructor(@Inject(LogsService) private logsService: LogsService, @Inject(REQUEST_PROXY) private readonly requestProxy: AppRequest) { }

  // Helper to construct filter object from query params
  private buildFilter(queryParams: Record<string, string | string[]>): LogsFilterRequest {
    const filter: LogsFilterRequest = {};
    if (queryParams.level) filter.level = queryParams.level as LogLevel;
    if (queryParams.category) filter.category = queryParams.category as LogCategory;
    if (queryParams.userId) filter.userId = queryParams.userId as string;
    if (queryParams.startDate) filter.startDate = new Date(queryParams.startDate as string);
    if (queryParams.endDate) filter.endDate = new Date(queryParams.endDate as string);
    if (queryParams.acknowledged) filter.acknowledged = queryParams.acknowledged === 'true';
    // Add other filter properties as needed
    return filter;
  }

  @Get()
  async getLogs(@Res() ctx: Context): Promise<void> {
    const url = new URL(this.requestProxy.url);
    const filter = this.buildFilter(Object.fromEntries(url.searchParams.entries()));
    const logs = await this.logsService.list(filter);
    ctx.res = new Response(JSON.stringify(logs.map(log => ({ ...log }))), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return;
  }

  @Get('/:logId')
  async getLog(@Res() ctx: Context, @Param('logId') logId: string): Promise<void> {
    assert(logId, 'logId parameter is required');
    try {
      const log = await this.logsService.getById(logId);
      if (!log) {
        ctx.res = new Response(JSON.stringify({ error: 'Log not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
      } else {
        ctx.res = new Response(JSON.stringify({ ...log }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      }
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get log' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Post()
  async createLog(@Res() ctx: Context): Promise<void> {
    const data: CreateLogRequest = await this.requestProxy.json();
    try {
      const log = await this.logsService.create(data);
      ctx.res = new Response(JSON.stringify({ ...log }), {
        headers: { 'Content-Type': 'application/json' },
        status: 201
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to create log' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Patch('/:logId/acknowledge')
  async acknowledgeLog(@Res() ctx: Context, @Param('logId') logId: string): Promise<void> {
    assert(logId, 'logId parameter is required');
    const { userId }: Pick<AcknowledgeLogRequest, 'userId'> = await this.requestProxy.json();
    assert(userId, 'userId is required in the request body');

    try {
      const success = await this.logsService.acknowledge(logId, userId);
      ctx.res = new Response(JSON.stringify({ success }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to acknowledge log' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Get('/analytics')
  async getLogsAnalytics(@Res() ctx: Context): Promise<void> {
    const url = new URL(this.requestProxy.url);
    const filter = this.buildFilter(Object.fromEntries(url.searchParams.entries()));
    try {
      const analytics = await this.logsService.getAnalytics(filter);
      ctx.res = new Response(JSON.stringify(JSON.parse(JSON.stringify(analytics))), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get logs analytics' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Get('/top-users')
  async getTopUsers(@Res() ctx: Context): Promise<void> {
    const url = new URL(this.requestProxy.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    try {
      const topUsers = await this.logsService.getTopUsers(limit);
      ctx.res = new Response(JSON.stringify(JSON.parse(JSON.stringify(topUsers))), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get top users' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Get('/top-sources')
  async getTopSources(@Res() ctx: Context): Promise<void> {
    const url = new URL(this.requestProxy.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    try {
      const topSources = await this.logsService.getTopSources(limit);
      ctx.res = new Response(JSON.stringify(JSON.parse(JSON.stringify(topSources))), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get top sources' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Get('/trends')
  async getLogsTrend(@Res() ctx: Context): Promise<void> {
    const url = new URL(this.requestProxy.url);
    const days = parseInt(url.searchParams.get('days') || '30', 10);
    try {
      const trend = await this.logsService.getLogsTrend(days);
      ctx.res = new Response(JSON.stringify(JSON.parse(JSON.stringify(trend))), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get logs trend' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }
}
