import { events, FetchUserNodeData, FetchUserNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { WorkflowExecutionsService } from "@/lib/services/workflow-executions.service";
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { workflowInject } from "@/lib/injector/utils";
import { UsersService } from "@/lib/services/users.service";

export const fetchUserService = restate.object({
  name: "fetchUser",
  handlers: {
    executeNode: workflowInject(
      [UsersService, WorkflowExecutionsService],
      async ({}, [usersService, workflowExecutionsService], c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: res = {} }: ExecuteNodeFunctionProps) => {
      const config = await c.run('validate-config', async () => {
        return FetchUserNodeDataSchema.parse(nodeData.config || {});
      });

      const variables = workflowExecutionsService.getConfiguration(config, res) as FetchUserNodeData;

      const u = await c.run('execute-fetch-user', async () => {
        try {
          const user = variables.by === 'email' ? await usersService.getUserByEmail(variables.value) : await usersService.getUser(variables.value);
          return user;
        } catch (error) {
          return null;
        }
      });

      const eventName = u ? events.found : events.notFound;

      return workflowExecutionsService.nextOrEndExecution({ nodeData, event: eventName, executionId, globalResult: res, localResult: u as unknown as Record<string, unknown>, yaml, domain, token });
    }
  ),
  },
});

export type FetchUserService = typeof fetchUserService;