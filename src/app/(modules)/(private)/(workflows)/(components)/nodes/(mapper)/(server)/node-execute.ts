
import { get } from "lodash";
import { events, MapperNodeDataSchema, MapperNodeData } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { WorkflowExecutionsService } from "@/lib/services";
import { workflowInject } from "@/lib/injector/utils";

export const mapperService = restate.object({
  name: "mapper",
  handlers: {
    executeNode: workflowInject(
      [WorkflowExecutionsService],
      async ({}, [workflowExecutionsService], c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        const config = await c.run('validate-config', async () => {
          return MapperNodeDataSchema.parse(nodeData.config || {});
        });

        const variables = await workflowExecutionsService.getConfiguration(config, r) as MapperNodeData;

        const sourceObject = get(variables.ctx, variables.propertyPath);

        const eventName = events.mapped

        return await workflowExecutionsService.nextOrEndExecution({ nodeData, event: eventName, executionId, localResult: { sourceObject }, globalResult: r, yaml, domain, token });
      }
    ),
  },
});

export type MapperService = typeof mapperService;
