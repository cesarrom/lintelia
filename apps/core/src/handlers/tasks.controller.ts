import { Controller, Get, Inject, Param, Post, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Require } from '../auth/access';
import { TasksService, type DecisionInput } from '../services/tasks.service';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle } from '../http/respond';
import { BadRequestError } from '../http/errors';

/** The member's work: task inbox (mine / my queues / all), claim, assign and decide. */
@Controller({ path: '/tasks', scope: Scope.REQUEST })
export class TasksHandler {
  constructor(
    @Inject(TasksService) private readonly tasks: TasksService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  /** The work inbox is for people who work tasks (`view=all` additionally needs tasks:assign). */
  @Require('tasks:work')
  @Get()
  list(@Res() ctx: Context) {
    const view = new URL(this.request.url).searchParams.get('view');
    return handle(ctx, () => this.tasks.list(view === 'queue' || view === 'all' ? view : 'mine'), 'Failed to list tasks');
  }

  @Require('cases:read')
  @Get('/:taskId')
  get(@Param('taskId') taskId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.tasks.get(taskId), 'Failed to load the task');
  }

  @Require('tasks:work')
  @Post('/:taskId/claim')
  claim(@Param('taskId') taskId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.tasks.claim(taskId), 'Failed to claim the task');
  }

  @Require('tasks:assign')
  @Post('/:taskId/assign')
  assign(@Param('taskId') taskId: string, @Res() ctx: Context) {
    return handle(ctx, async () => {
      const { assigneeId } = await this.request.json<{ assigneeId?: string }>();
      if (!assigneeId) throw new BadRequestError('assigneeId is required');
      return this.tasks.assign(taskId, assigneeId);
    }, 'Failed to assign the task');
  }

  @Require('tasks:work')
  @Post('/:taskId/decision')
  decide(@Param('taskId') taskId: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.tasks.decide(taskId, await this.request.json<DecisionInput>()), 'Failed to record the decision');
  }
}
