import { SystemVariable } from "@repo/fintivio/schemas";
import { CreateSystemVariableInput, UpdateSystemVariableInput } from "@repo/fintivio/schemas";
import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { RestateService } from "./restate.abstract.service";
import { Scope, Injectable, Inject } from "@nestjs/common";
import { SystemVariablesService } from "../../services/system-variables.service";

@Injectable({
  scope: Scope.REQUEST
})
export class SystemService extends RestateService<'system'> {
  object = object({
    name: "system",
    handlers: {

      // System Variables Actions
      getSystemVariables: async (c: ObjectContext): Promise<SystemVariable[]> => {
        const variables = await this.systemVariablesService.list();

        return JSON.parse(JSON.stringify(variables));
      },

      getSystemVariableNames: async (c: ObjectContext): Promise<(Omit<SystemVariable, 'value'>)[]> => {
          const variables = await this.systemVariablesService.list();

          return JSON.parse(JSON.stringify(variables.map(v => ({
            ...v,
            'value': undefined
          }))));
      },

      getSystemVariable: async (c: ObjectContext, id: string): Promise<SystemVariable> => {
          return JSON.parse(JSON.stringify(await this.systemVariablesService.getById(id)));
      },

      createSystemVariable: async (c: ObjectContext, data: CreateSystemVariableInput): Promise<SystemVariable> => {
          const variable = await this.systemVariablesService.create(data);

          return JSON.parse(JSON.stringify(variable));
      },

      updateSystemVariable: async (c: ObjectContext, { id, data }: { id: string, data: UpdateSystemVariableInput }): Promise<SystemVariable> => {
          const variable = await this.systemVariablesService.update(id, data);

          return JSON.parse(JSON.stringify(variable));
      },

      deleteSystemVariable: async (c: ObjectContext, id: string) => {
          const success = await this.systemVariablesService.delete(id);

          return success;
      },
    },
  });

  constructor(
    @Inject(SystemVariablesService) private systemVariablesService: SystemVariablesService,

  ) {
    super();
  }
}
