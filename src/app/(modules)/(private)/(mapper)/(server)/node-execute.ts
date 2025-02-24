
import { get } from "lodash";
import { events, MapperNodeDataSchema, MapperNodeData } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { nextOrEndExecution, getConfiguration } from "@/lib/restate-utils";
import { NodeData } from "../../(workflows)/(components)/yaml/types";
import { ExecuteNodeFunctionProps } from "../../(workflows)/types";

export const mapperService = restate.object({
  name: "mapper",
  handlers: {
    executeNode: async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token }: ExecuteNodeFunctionProps) => {
      const config = await c.run('validate-config', async () => {
        return MapperNodeDataSchema.parse(nodeData.config || {});
      });

      const variables = await getConfiguration(c, executionId, config) as MapperNodeData;

      const sourceObject = get(variables.ctx, variables.propertyPath);

      const eventName = events.mapped

      return nextOrEndExecution(c, { nodeData, event: eventName, executionId, result: sourceObject, yaml, domain, token });
    }
  },
});

export type MapperService = typeof mapperService;
