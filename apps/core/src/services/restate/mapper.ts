
import { get } from "lodash";
import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { WorkflowExecutionsService } from "../../services/workflow-executions.service";
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { mapperNodeConfigSchema, MapperNodeConfig, WORKFLOW_EVENTS } from "@repo/fintivio/schemas";
import { RestateService } from "./restate.abstract.service";
import { Inject, Scope, Injectable } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class MapperService extends RestateService<'mapper'> {
  object = object({
    name: "mapper",
    handlers: {
      executeNode: async (c: ObjectContext, { executionId, nodeData, workflowId, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        const config = await c.run('validate-config', async () => {
          return mapperNodeConfigSchema.parse(nodeData.config || {});
        });

        const variables = await this.workflowExecutionsService.getConfiguration(config, r) as MapperNodeConfig;

        const sourceObject = get(variables.ctx, variables.propertyPath);

        const eventName = WORKFLOW_EVENTS.mapper.mapped

        return await this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: eventName, executionId, localResult: { sourceObject }, globalResult: r, workflowId, domain, token });
      },
    },
  });

  constructor(@Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService) {
    super();
  }
}
