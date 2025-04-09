
import { get } from "lodash";
import { events, IteratorNodeDataSchema, IteratorNodeData } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { yamlToWorkflow } from "@/app/(modules)/(private)/(workflows)/(components)/yaml/converter";
import { WorkflowExecutionsService } from "@/lib/services";
import { workflowInject } from "@/lib/injector/utils";

export const iteratorService = restate.object({
  name: "iterator",
  handlers: {
    executeNode: workflowInject(
      [WorkflowExecutionsService],
      async ({ }, [workflowExecutionsService], c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
      const config = await c.run('validate-config', async () => {
        return IteratorNodeDataSchema.parse(nodeData.config || {});
      });

      const variables = await workflowExecutionsService.getConfiguration(config, r) as IteratorNodeData;

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
        const nextNodes = workflowExecutionsService.getNextNodes({ nodeData, yaml, event: eventName }, { forceExecution: nodeEdges.map(e => e.target) });
        const re = await workflowExecutionsService.nextOrEndExecution({ nodeData, event: eventName, executionId, localResult: { item, index }, globalResult: r, yaml, domain, token, nextNodes });

        Object.assign(output, re);
      }

      const eventName = events.done;

      return await workflowExecutionsService.nextOrEndExecution({ nodeData, event: eventName, executionId, localResult: output, globalResult: r, yaml, domain, token });
    }
  ),
  },
});

export type IteratorService = typeof iteratorService;