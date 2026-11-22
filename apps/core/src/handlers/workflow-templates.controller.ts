import { Controller, Get, Inject, Param, Post, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Require } from '../auth/access';
import { WorkflowLifecycleService } from '../services/workflow-lifecycle.service';
import { handle } from '../http/respond';

/** Ready-made workflows (loan pre-approval, suspicious activity, account opening) institutions start from. */
@Controller({ path: '/workflow-templates', scope: Scope.REQUEST })
export class WorkflowTemplatesHandler {
  constructor(@Inject(WorkflowLifecycleService) private readonly lifecycle: WorkflowLifecycleService) { }

  @Require('workflows:read')
  @Get()
  list(@Res() ctx: Context) {
    return handle(ctx, () => this.lifecycle.templates(), 'Failed to list templates');
  }

  /** Create a draft workflow from a template. */
  @Require('workflows:manage')
  @Post('/:templateId/use')
  use(@Param('templateId') templateId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.lifecycle.createFromTemplate(templateId), 'Failed to create the workflow', 201);
  }
}
