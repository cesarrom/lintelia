import assert from "assert";
import { WorkflowsService } from "../services/workflows.service";
import { LogsService } from "../services/logs.service";
import { SystemTriggersService } from "../services/system-triggers.service";
import { fromTriggerDefinition, yamlToWorkflow } from "@repo/fintivio/utilities";
import { USER } from "../injector/tokens/user.token";
import type { User } from "@repo/fintivio/schemas";
import { Scope, Inject, Controller, Put, Get, Patch, Param, Res, Post, type RawBodyRequest } from "@nestjs/common";
import type { HonoRequest } from "hono/request";
import type { Context } from "hono";
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";

@Controller({
  path: '/workflows',
  scope: Scope.REQUEST
})
export class WorkflowHandler {
  constructor(
    @Inject(WorkflowsService) private workflowsService: WorkflowsService,
    @Inject(LogsService) private logs: LogsService,
    @Inject(SystemTriggersService) private systemTriggersService: SystemTriggersService,
    @Inject(USER) private user: User,
    @Inject(REQUEST_PROXY) private readonly requestProxy: AppRequest
  ) { }

  private async create({ yaml }: { yaml: string }) {
    assert(this.user?.email, 'User email is required');

    const { triggers } = yamlToWorkflow(yaml);

    await this.logs.info('Creating new workflow', {
      category: 'workflow',
      source: 'WorkflowActions',
      userId: this.user?.email
    });

    const wfl = await this.workflowsService.saveWorkflow({
      yaml,
      createdBy: this.user?.email,
    });

    for (const trigger of triggers) {
      await this.systemTriggersService.createTrigger(fromTriggerDefinition(trigger, {
        createdBy: this.user?.email,
        workflowId: wfl.id!,
        active: true
      }));
    }

    return {
      id: wfl.id,
      yaml: wfl.yaml
    };
  }

  private async update({ yaml, workflowId }: { yaml: string, workflowId: string }) {
    assert(this.user?.email, 'User email is required');

    await this.logs.info('Updating workflow', {
      category: 'workflow',
      source: 'WorkflowActions',
      userId: this.user?.email,
      metadata: { workflowId }
    });

    const { triggers } = yamlToWorkflow(yaml);

    const existingTriggers = await this.systemTriggersService.getAllByWorkflowId(workflowId);

    await this.systemTriggersService.swapTriggersForWorkflow(
      existingTriggers.map(t => t.id!),
      triggers.map(t => {
        t.id = undefined as any;
        return fromTriggerDefinition(t, {
          createdBy: this.user?.email || 'system',
          workflowId,
          active: true
        });
      })
    );

    const updatedWorkflow = await this.workflowsService.updateWorkflow(workflowId, {
      yaml,
    });

    return {
      id: updatedWorkflow.id!,
      yaml: updatedWorkflow.yaml
    };
  }

  @Get()
  async list(@Res() ctx: Context): Promise<void> {
    await this.logs.debug('Listing workflows', {
      category: 'workflow',
      source: 'WorkflowActions'
    });

    try {
      const workflows = await this.workflowsService.listWorkflows();
      const responseBody = workflows.map((workflow) => ({ ...workflow }));
      ctx.res = new Response(JSON.stringify(responseBody), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to list workflows';
      ctx.res = new Response(JSON.stringify({ error: message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Get('/:workflowId')
  async load(@Param('workflowId') workflowId: string, @Res() ctx: Context): Promise<void> {
    assert(workflowId, 'workflowId parameter is required');

    await this.logs.debug('Loading workflow', {
      category: 'workflow',
      source: 'WorkflowActions',
      metadata: { workflowId }
    });

    try {
      const workflow = await this.workflowsService.loadWorkflow(workflowId);
      if (!workflow) {
        ctx.res = new Response(JSON.stringify({ error: 'Workflow not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
      } else {
        ctx.res = new Response(JSON.stringify({ id: workflow.id, yaml: workflow.yaml }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load workflow';
      ctx.res = new Response(JSON.stringify({ error: message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Post('/')
  async createWorkflow(@Res() ctx: Context): Promise<void> {
    assert(this.user?.email, 'User email is required');

    try {
      const { yaml }: { yaml: string } = await this.requestProxy.json();
      assert(yaml, 'yaml is required in the request body');

      const result = await this.create({ yaml });

      ctx.res = new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
        status: 201
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create workflow';
      await this.logs.error('Failed to create workflow', {
        category: 'workflow',
        source: 'WorkflowActions',
        userId: this.user?.email,
        metadata: { error: message }
      });
      ctx.res = new Response(JSON.stringify({ error: message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Put('/:workflowId')
  async updateWorkflow(@Param('workflowId') workflowId: string, @Res() ctx: Context): Promise<void> {
    assert(this.user?.email, 'User email is required');
    assert(workflowId, 'workflowId parameter is required');

    try {
      const { yaml }: { yaml: string } = await this.requestProxy.json();
      assert(yaml, 'yaml is required in the request body');

      const result = await this.update({ workflowId, yaml });

      ctx.res = new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update workflow';
      await this.logs.error('Failed to update workflow', {
        category: 'workflow',
        source: 'WorkflowActions',
        userId: this.user?.email,
        metadata: { workflowId, error: message }
      });
      ctx.res = new Response(JSON.stringify({ error: message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Patch('/:workflowId/set-state/:status')
  async setStatus(@Param('workflowId') workflowId: string, @Param('status') status: 'draft' | 'active' | 'archived', @Res() ctx: Context): Promise<void> {
    assert(workflowId, 'workflowId parameter is required');
    assert(status && (status === 'draft' || status === 'active' || status === 'archived'), 'status parameter must be draft, active or archived');

    await this.logs.info('Setting workflow status', {
      category: 'workflow',
      source: 'WorkflowActions',
      metadata: {
        workflowId,
        status
      }
    });

    try {
      const workflow = await this.workflowsService.setWorkflowStatus(workflowId, status);
      if (!workflow) {
        ctx.res = new Response(JSON.stringify({ error: 'Workflow not found or status unchanged' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
      } else {
        ctx.res = new Response(JSON.stringify({ id: workflow.id, status: workflow.status }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to set workflow status';
      ctx.res = new Response(JSON.stringify({ error: message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }
}