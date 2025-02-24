
import { get } from "lodash";
import { events, IteratorNodeDataSchema, IteratorNodeData } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { nextOrEndExecution, getConfiguration } from "@/lib/restate-utils";
import { NodeData } from "../../(workflows)/(components)/yaml/types";
import { yamlToWorkflow } from "../../(workflows)/(components)/yaml/converter";
import { ExecuteNodeFunctionProps } from "../../(workflows)/types";

export const iteratorService = restate.object({
  name: "iterator",
  handlers: {
    executeNode: async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
      const config = await c.run('validate-config', async () => {
        return IteratorNodeDataSchema.parse(nodeData.config || {});
      });

      const variables = await getConfiguration(c, executionId, config, r) as IteratorNodeData;

      const arrayToIterate = get(variables.ctx, variables.pathToArrayInContext, []);
      const { edges } = yamlToWorkflow(yaml);
      if (!Array.isArray(arrayToIterate)) {
        throw new Error(`Path ${variables.pathToArrayInContext} does not point to an array, it points to ${typeof arrayToIterate}`);
      }

      const nodeEdges = edges.filter(e => e.source === nodeData.id && e.sourceHandle === eventName);

      if (!nodeEdges.length) {
        throw new Error('Edges not found');
      }

      const output: Record<string, unknown> = {};

      for (let index = 0; index < arrayToIterate.length; index++) {
        const item = arrayToIterate[index];
        const eventName = events.item + '::' + index;

        const re = await nextOrEndExecution(c, { nodeData, event: eventName, executionId, localResult: { item, index }, globalResult: r, yaml, domain, token }, { forceExecution: nodeEdges.map(e => e.target) });

        Object.assign(output, re);
      }

      const eventName = events.done;

      return nextOrEndExecution(c, { nodeData, event: eventName, executionId, localResult: output, globalResult: r, yaml, domain, token });
    }
  },
});

export type IteratorService = typeof iteratorService;