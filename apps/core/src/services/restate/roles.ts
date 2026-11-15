import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { RestateService } from "./restate.abstract.service";
import { RolesService } from "../../services/roles.service";
import { Scope, Injectable, Inject } from "@nestjs/common";
import { CreateRoleRequest, UpdateRoleRequest } from "@repo/fintivio/schemas";

@Injectable({
  scope: Scope.REQUEST
})
export class RoleService extends RestateService<'roles'> {
  object = object({
    name: "roles",
    handlers: {
      // Get all roles
      getRoles: async (c: ObjectContext) => {
        const roles = await this.rolesService.listRoles();

        return roles;
      },

      getRolesByUserId: async (c: ObjectContext, userId: string) => {
        const roles = await this.rolesService.getRolesByUserId({ userId });

        return roles;
      },

      // Get a role by ID
      getRole: async (c: ObjectContext, id: string) => {
        return this.rolesService.getRole(id);
      },

      // Create a new role
      createRole: async (c: ObjectContext, data: CreateRoleRequest) => {
        const role = await this.rolesService.createRole(data);

        return role;
      },

      // Update a role
      updateRole: async (c: ObjectContext, { id, data }: UpdateRoleRequest) => {
        const role = await this.rolesService.updateRole(id, data);

        return role;
      },

      // Delete a role
      deleteRole: async (c: ObjectContext, id: string) => {
        const success = await this.rolesService.deleteRole(id);

        return success;
      },
    },
  });

  constructor(
    @Inject(RolesService) private rolesService: RolesService,
  ) {
    super();
  }
}
