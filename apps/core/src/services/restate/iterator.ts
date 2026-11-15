
import { get } from "lodash";
import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { WorkflowExecutionsService } from "../../services/workflow-executions.service";
import { IteratorNodeConfig, iteratorNodeConfigSchema, WORKFLOW_EVENTS } from "@repo/fintivio/schemas";
import { yamlToWorkflow } from "@repo/fintivio/utilities";
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { RestateService } from "./restate.abstract.service";
import { Inject, Scope, Injectable } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class IteratorService extends RestateService<'iterator'> {
  object = object({
    name: "iterator",
    handlers: {
      executeNode: async (c: ObjectContext, { executionId, nodeData, workflowId, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        const config = await c.run('validate-config', async () => {
          return iteratorNodeConfigSchema.parse(nodeData.config || {});
        });

        const variables = await this.workflowExecutionsService.getConfiguration(config, r) as IteratorNodeConfig;

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
          const eventName = WORKFLOW_EVENTS.iterator.item + '::' + index;
          const nextNodes = this.workflowExecutionsService.getNextNodes({ nodeId: nodeData.id, yaml, event: eventName }, { forceExecution: nodeEdges.map(e => e.target) });
          const re = await this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: eventName, executionId, localResult: { item, index }, globalResult: r, workflowId, domain, token, nextNodes });

          Object.assign(output, re);
        }

        const eventName = WORKFLOW_EVENTS.iterator.done;

        return await this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: eventName, executionId, localResult: output, globalResult: r, workflowId, domain, token });
      },
    },
  });

  constructor(
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
  ) {
    super();
  }
}