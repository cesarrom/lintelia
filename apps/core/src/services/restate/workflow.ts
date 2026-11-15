
import { type ObjectContext, object, TerminalError } from "@restatedev/restate-sdk/fetch";
import { ResumeWorkflowRequest, SaveWorkflowRequest, SetWorkflowStatusRequest, StartWorkflowRequest, TriggerWorkflowRequest, type User, WORKFLOW_EVENTS, WorkflowNodeConfig, workflowNodeConfigSchema } from "@repo/fintivio/schemas";
import assert from "assert";
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { RolesService } from "../../services/roles.service";
import { WorkflowExecutionsService } from "../../services/workflow-executions.service";
import { WorkflowsService } from "../../services/workflows.service";
import { LogsService } from "../logs.service";
import { SystemTriggersService } from "../system-triggers.service";
import { fromTriggerDefinition, yamlToWorkflow } from "@repo/fintivio/utilities";
import { RestateService } from "./restate.abstract.service";
import { USER } from "../../injector/tokens/user.token";
import { Inject, Scope, Injectable } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class WorkflowService extends RestateService<'workflow'> {
  object = object({
    name: "workflow",
    handlers: {
      executeNode: async (c: ObjectContext, { executionId, nodeData, yaml, domain, token, result, workflowId }: ExecuteNodeFunctionProps) => {
        const config = await c.run('validate-config', () => {
          return workflowNodeConfigSchema.parse(nodeData.config || {});
        });

        const variables = this.workflowExecutionsService.getConfiguration(config.inputMap, result) as WorkflowNodeConfig;

        const client = c.objectClient(this.object, c.key);

        const r = await client.start({
          variables,
          workflowId,
          yaml,
          token,
          domain,
          result: {}
        }) as Record<string, Record<string, unknown>>;

        const outputs = {};

        for (const [key, value] of Object.entries(r)) {
          const r = await this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: key, executionId, globalResult: result, localResult: value, workflowId, domain, token });
          Object.assign(outputs, r);
        }

        return outputs;
      },
      start: this.start.bind(this),
      trigger: async (c: ObjectContext, { variables, workflowId, token, domain, result }: TriggerWorkflowRequest) => {
        const { yaml } = await c.run('load-workflow', async () => await this.workflowsService.loadWorkflow(workflowId));

        return await this.start(c, {
          workflowId,
          variables,
          yaml,
          token,
          domain,
          result,
        }) as Record<string, Record<string, unknown>>;
      },
      resume: async (c: ObjectContext, { resumableId, result, domain, token, workflowId }: ResumeWorkflowRequest) => {
        return this.workflowExecutionsService.resumeExecution(c, { resumableId, result, domain, token, workflowId });
      },
      list: async (c: ObjectContext) => {
        await this.logs.debug('Listing workflows', {
          category: 'workflow',
          source: 'WorkflowActions'
        });

        const workflows = await this.workflowsService.listWorkflows();
        return workflows.map((workflow) => ({
          ...workflow,
        }));
      },
      load: async (c: ObjectContext, workflowId: string) => {
        await this.logs.debug('Loading workflow', {
          category: 'workflow',
          source: 'WorkflowActions',
          metadata: { workflowId }
        });

        const workflow = await this.workflowsService.loadWorkflow(workflowId);
        return {
          id: workflow.id,
          yaml: workflow.yaml
        };
      },
      create: this.createFn.bind(this),
      update: this.updateFn.bind(this),
      save: async (c: ObjectContext, { workflowId, yaml }: SaveWorkflowRequest) => {
        assert(this.user?.email, 'User email is required');
        try {
          if (workflowId) {
            return await this.updateFn(c, { workflowId, yaml });
          } else {
            return await this.createFn(c, { yaml });
          }
        } catch (error) {
          await this.logs.error('Failed to save workflow', {
            category: 'workflow',
            source: 'WorkflowActions',
            userId: this.user?.email,
            metadata: {
              workflowId,
              error: error instanceof Error ? error.message : String(error)
            }
          });
          throw error;
        }
      },
      setStatus: async (c: ObjectContext, { workflowId, status }: SetWorkflowStatusRequest) => {
        await this.logs.info('Setting workflow status', {
          category: 'workflow',
          source: 'WorkflowActions',
          metadata: {
            workflowId,
            status
          }
        });

        const workflow = await this.workflowsService.setWorkflowStatus(workflowId, status);
        return {
          id: workflow.id,
          status: workflow.status
        };
      },
    },
  });

  constructor(
    @Inject(RolesService) private rolesService: RolesService,
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
    @Inject(WorkflowsService) private workflowsService: WorkflowsService,
    @Inject(LogsService) private logs: LogsService,
    @Inject(SystemTriggersService) private systemTriggersService: SystemTriggersService,
    @Inject(USER) private user: User,
  ) {
    super();
  }

  async createFn(c: ObjectContext, { yaml }: { yaml: string }) {
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

  async updateFn(c: ObjectContext, { yaml, workflowId }: { yaml: string, workflowId: string }) {
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

  private async start(c: ObjectContext, { variables, yaml, token, domain, workflowId }: StartWorkflowRequest) {
    assert(this.user, 'User not found');

    const executionId = c.rand.uuidv4();

    const roles = await c.run('roles', async () => this.rolesService.getRolesByUserId({ userId: this.user.userId }));

    const { workflow, nodes } = yamlToWorkflow(yaml);

    const allowedRoles = workflow.allowedRoles || [];

    const allowedUsers = workflow.allowedUsers || [];

    const hasAccess = allowedRoles.length === 0 || allowedRoles.some((role) => roles.some((r) => r === role)) || allowedUsers.some((userId) => userId === this.user.userId);

    if (!hasAccess) {
      throw new Error('User does not have access to this workflow');
    }

    const startNode = nodes.find((node) => node.type === 'start');

    if (!startNode) {
      throw new TerminalError('Start node not found');
    }

    const result = await this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: startNode.data.id, event: WORKFLOW_EVENTS.workflow.done, executionId, globalResult: {}, localResult: variables, workflowId, domain, token });

    return result;
  }
}