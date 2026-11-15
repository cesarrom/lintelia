import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { WorkflowExecutionsService } from "../../services/workflow-executions.service";
import { UsersService } from "../../services/users.service";
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { FetchUserNodeConfig, fetchUserNodeConfigSchema, InviteUserInput, UpdateUserRolesRequest, WORKFLOW_EVENTS } from "@repo/fintivio/schemas";
import { RestateEndpoint, RestateService } from "./restate.abstract.service";
import { Scope, Injectable, Inject } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class UserService extends RestateService<'users'> {
  fetchUserObject = object({
    name: "fetchUser",
    handlers: {
      executeNode: async (c: ObjectContext, { executionId, nodeData, workflowId, domain, token, result: res = {} }: ExecuteNodeFunctionProps) => {
        const config = await c.run('validate-config', async () => {
          return fetchUserNodeConfigSchema.parse(nodeData.config || {});
        });

        const variables = this.workflowExecutionsService.getConfiguration(config, res) as FetchUserNodeConfig;

        const u = await c.run('execute-fetch-user', async () => {
          try {
            const user = variables.by === 'email' ? await this.usersService.getUserByEmail(variables.value) : await this.usersService.getUser(variables.value);
            return user;
          } catch (error) {
            return null;
          }
        });

        const eventName = u ? WORKFLOW_EVENTS.fetchUser.found : WORKFLOW_EVENTS.fetchUser.notFound;

        return this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: eventName, executionId, globalResult: res, localResult: u as unknown as Record<string, unknown>, workflowId, domain, token });
      }
    },
  });
  object = object({
    name: "users",
    handlers: {
      // List users
      getUsers: async (c: ObjectContext) => {
        const users = await this.usersService.listUsers();

        return users;
      },

      // Get a user by ID
      getUser: async (c: ObjectContext, id: string) => {
        return this.usersService.getUser(id);
      },

      // Invite a new user
      inviteUser: async (c: ObjectContext, data: InviteUserInput) => {
        const success = await this.usersService.inviteUser(data);

        return success;
      },

      // Update user roles
      updateUserRoles: async (c: ObjectContext, { userId, roleIds }: UpdateUserRolesRequest) => {
        const success = await this.usersService.updateUserRoles(userId, roleIds);

        return success;
      },

      // Deactivate a user
      deactivateUser: async (c: ObjectContext, userId: string) => {
        const success = await this.usersService.deactivateUser(userId);

        return success;
      },

      // Activate a user
      activateUser: async (c: ObjectContext, userId: string) => {
        const success = await this.usersService.activateUser(userId);

        return success;
      },

      // Reset user password
      resetUserPassword: async (c: ObjectContext, userId: string) => {
        const success = await this.usersService.resetPassword(userId);

        return success;
      },
    },
  });

  constructor(
    @Inject(UsersService) private usersService: UsersService,
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
  ) {
    super();
  }

  bind(endpoint: RestateEndpoint) {
    endpoint.bind(this.object);
    endpoint.bind(this.fetchUserObject);
  }
}