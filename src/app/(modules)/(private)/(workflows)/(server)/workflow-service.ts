
import * as restate from "@restatedev/restate-sdk/fetch";
import { events, ExecutableNode, ExecuteNodeFunction, ExecuteNodeFunctionProps, workflowNodeDataSchema } from "../types";
import { yamlToWorkflow } from "../(components)/yaml/converter";
import { getUserRoles } from "@/app/(modules)/(public)/(auth)/(actions)/actions";
import { nextOrEndExecution, getConfiguration, mergeResult } from "@/lib/restate-utils";
import assert from "assert";
import { auth } from "@/lib/clients/auth.client";

export const workflowService = restate.object({
  name: "workflow",
  handlers: {
    executeNode: (async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result }: ExecuteNodeFunctionProps) => {
      const config = await c.run('validate-config', () => {
        return workflowNodeDataSchema.parse(nodeData.config || {});
      });

      const variables = await getConfiguration(c, executionId, config.inputMap);

      const client = c.objectClient(workflowService, c.key);

      const r = await client.start({
        variables,
        yaml,
        token,
        domain
      })

      return nextOrEndExecution(c, { nodeData, event: events.done, executionId, globalResult: result, localResult: r, yaml, domain, token });
    }) as ExecuteNodeFunction,
    start: async (c: restate.ObjectContext, { variables, yaml, token, domain }: { variables: Record<string, unknown>, yaml: string, token: string, domain: string }) => {
      const info = await c.run('validate-session', () => auth.validateJwt(token));

      assert(info?.token?.sub, 'Valid token is required');

      const { data: user } = await c.run('fetching-user', () => auth.management.user.loadByUserId(info?.token?.sub || ''));

      assert(user, 'User not found');

      const executionId = c.rand.uuidv4();

      const roles = await c.run('roles', async () => getUserRoles({ domain, token }));

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

      return nextOrEndExecution(c, { nodeData: startNode.data, event: events.done, executionId, globalResult: {}, localResult: variables, yaml, domain, token });
    }
  },
});

export type WorkflowService = typeof workflowService;