import { events, DecisionTableNodeDataSchema, DecisionTableNodeData } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { workflowInject } from '@/lib/injector/utils';
import { WorkflowExecutionsService } from '@/lib/services/workflow-executions.service';
import { parseDMN } from "../(utils)/utils";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { decisionTable } = require('@hbtgmbh/dmn-eval-js');

async function evaluateDecisionTable({ xml, targetDmnId: riskId, outputName }: DecisionTableNodeData, context: Record<string, unknown>) {
  const decisions = await parseDMN(xml);

  const output = decisionTable.evaluateDecision(riskId, decisions, context);

  const result = output[outputName];

  if (!result) {
    throw new Error("Failed to evaluate dmn");
  }

  return result;
}

export const decisionTableService = restate.object({
  name: "decisionTable",
  handlers: {
    executeNode: workflowInject(
      [WorkflowExecutionsService],
      async ({}, [workflowExecutionsService], c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        const config = await c.run('validate-config', async () => {
          return DecisionTableNodeDataSchema.parse(nodeData.config || {});
        });

        const variables = workflowExecutionsService.getConfiguration(config, r) as DecisionTableNodeData;

        const result = await evaluateDecisionTable(variables, variables.ctx);

        const eventName = events.success;

        return workflowExecutionsService.nextOrEndExecution({ nodeData, event: eventName, executionId, localResult: result, globalResult: r, yaml, domain, token });
      }
    ),
  },
});

export type DecisionTableService = typeof decisionTableService;