import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { WorkflowExecutionsService } from '../../services/workflow-executions.service';
import { DecisionTableNodeConfig, decisionTableNodeConfigSchema, WORKFLOW_EVENTS } from "@repo/fintivio/schemas";
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { RestateService } from "./restate.abstract.service";
import { parseDMN } from "../../utils/dmn";
// eslint-disable-next-line @typescript-eslint/no-require-imports
// const { decisionTable } = require('@hbtgmbh/dmn-eval-js');
import { Injectable, Scope, Inject } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class DecisionTableService extends RestateService<'decisionTable'> {
  object = object({
    name: "decisionTable",
    handlers: {
      executeNode:  async (c: ObjectContext, { executionId, nodeData, workflowId, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        const config = await c.run('validate-config', async () => {
          return decisionTableNodeConfigSchema.parse(nodeData.config || {});
        });

        const variables = this.workflowExecutionsService.getConfiguration(config, r) as DecisionTableNodeConfig;

        const result = await this.evaluateDecisionTable(variables, variables.ctx);

        const eventName = WORKFLOW_EVENTS.decisionTable.success;

        return this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: eventName, executionId, localResult: result, globalResult: r, workflowId, domain, token });
      },
    },
  });

  constructor(
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
  ) {
    super();
  }

  async evaluateDecisionTable({ xml, targetDmnId: riskId, outputName }: DecisionTableNodeConfig, context: Record<string, unknown>) {
    const decisions = await parseDMN(xml);
  
    const output = {} as any // decisionTable.evaluateDecision(riskId, decisions, context);
  
    const result = output[outputName];
  
    if (!result) {
      throw new Error("Failed to evaluate dmn");
    }
  
    return result;
  }
  
}