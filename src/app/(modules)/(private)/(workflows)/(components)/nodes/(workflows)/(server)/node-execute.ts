
import * as restate from "@restatedev/restate-sdk/fetch";
import { events, WorkflowNodeData, workflowNodeDataSchema } from "../types";
import assert from "assert";
import { ExecuteNodeFunction, ExecuteNodeFunctionProps } from "../../../../types";
import { yamlToWorkflow } from "../../../yaml/converter";
import { workflowInject } from "@/lib/injector/utils";
import { RolesService, WorkflowExecutionsService, WorkflowsService } from "@/lib/services";

const start = workflowInject(
  [RolesService, WorkflowExecutionsService],
  async ({ user }, [rolesService, workflowExecutionsService], c: restate.ObjectContext, { variables, yaml, token, domain }: { variables: Record<string, unknown>, yaml: string, token: string, domain: string }) => {
    assert(user, 'User not found');

    const executionId = c.rand.uuidv4();

    const roles = await c.run('roles', async () => rolesService.getRolesByUserId({ userId: user.userId }));

    const { workflow, nodes } = yamlToWorkflow(yaml);

    const allowedRoles = workflow.allowedRoles || [];

    const allowedUsers = workflow.allowedUsers || [];

    const hasAccess = allowedRoles.length === 0 || allowedRoles.some((role) => roles.some((r) => r === role)) || allowedUsers.some((userId) => userId === user.userId);

    if (!hasAccess) {
      throw new Error('User does not have access to this workflow');
    }

    const startNode = nodes.find((node) => node.type === 'start');

    if (!startNode) {
      throw new restate.TerminalError('Start node not found');
    }

    const result = await workflowExecutionsService.nextOrEndExecution({ nodeData: startNode.data, event: events.done, executionId, globalResult: {}, localResult: variables, yaml, domain, token });

    return result;
  }
);

export const workflowService = restate.object({
  name: "workflow",
  handlers: {
    executeNode: workflowInject(
      [WorkflowExecutionsService],
      async ({ }, [workflowExecutionsService], c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result }: ExecuteNodeFunctionProps) => {
        const config = await c.run('validate-config', () => {
          return workflowNodeDataSchema.parse(nodeData.config || {});
        });

        const variables = workflowExecutionsService.getConfiguration(config.inputMap, result) as WorkflowNodeData;

        const client = c.objectClient(workflowService, c.key);

        const r = await client.start({
          variables,
          yaml,
          token,
          domain
        }) as Record<string, Record<string, unknown>>;

        const outputs = {};

        for (const [key, value] of Object.entries(r)) {
          const r = await workflowExecutionsService.nextOrEndExecution({ nodeData, event: key, executionId, globalResult: result, localResult: value, yaml, domain, token });
          Object.assign(outputs, r);
        }

        return outputs;
      }
    ) as ExecuteNodeFunction,
    start,
    trigger: workflowInject(
      [WorkflowsService],
      async ({ }, [ws], c, { variables, workflowId, token, domain }: { variables: Record<string, unknown>, workflowId: string, token: string, domain: string }) => {
        const { yaml } = await c.run('load-workflow', async () => await ws.loadWorkflow(workflowId));

        return start(c, {
          variables,
          yaml,
          token,
          domain
        });
      }
    ),
    resume: workflowInject(
      [WorkflowExecutionsService],
      async ({ }, [ws], c, { resumableId, result, domain, token }: { resumableId: string, domain: string, token: string, result: object }) => {
        return ws.resumeExecution({ resumableId, result, domain, token });
      }
    ),
  },
});

export type WorkflowService = typeof workflowService;