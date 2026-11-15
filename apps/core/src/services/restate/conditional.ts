import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { WorkflowExecutionsService } from "../../services/workflow-executions.service";
import { ConditionalNodeConfig, conditionalNodeConfigSchema, WORKFLOW_EVENTS } from "@repo/fintivio/schemas";
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { RestateService } from "./restate.abstract.service";
import { Injectable, Scope, Inject } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class ConditionalService extends RestateService<'conditional'> {
  object = object({
    name: "conditional",
    handlers: {
      executeNode: async (c: ObjectContext, { executionId, nodeData, workflowId, domain, token, result: res = {} }: ExecuteNodeFunctionProps) => {
        const config = await c.run('validate-config', async () => {
          return conditionalNodeConfigSchema.parse(nodeData.config || {});
        });

        const variables = this.workflowExecutionsService.getConfiguration(config, res) as ConditionalNodeConfig;

        const conditionalResult = await c.run('conditional', () => {

          let result = false;

          // Handle different operator types
          switch (variables.operator) {
            case 'equals':
              result = variables.leftValue === variables.rightValue;
              break;
            case 'notEquals':
              result = variables.leftValue !== variables.rightValue;
              break;
            case 'greaterThan':
              result = Number(variables.leftValue) > Number(variables.rightValue);
              break;
            case 'greaterThanOrEqual':
              result = Number(variables.leftValue) >= Number(variables.rightValue);
              break;
            case 'lessThan':
              result = Number(variables.leftValue) < Number(variables.rightValue);
              break;
            case 'lessThanOrEqual':
              result = Number(variables.leftValue) <= Number(variables.rightValue);
              break;
            case 'contains':
              result = String(variables.leftValue).includes(String(variables.rightValue));
              break;
            case 'notContains':
              result = !String(variables.leftValue).includes(String(variables.rightValue));
              break;
            case 'startsWith':
              result = String(variables.leftValue).startsWith(String(variables.rightValue));
              break;
            case 'endsWith':
              result = String(variables.leftValue).endsWith(String(variables.rightValue));
              break;
            case 'matches':
              result = new RegExp(String(variables.rightValue)).test(String(variables.leftValue));
              break;
            case 'isNull':
              result = variables.leftValue === null;
              break;
            case 'isNotNull':
              result = variables.leftValue !== null;
              break;
            case 'isEmpty':
              result = !variables.leftValue || String(variables.leftValue).trim() === '';
              break;
            case 'isNotEmpty':
              result = !!variables.leftValue && String(variables.leftValue).trim() !== '';
              break;
            case 'isTrue':
              result = variables.leftValue === true || variables.leftValue === 'true';
              break;
            case 'isFalse':
              result = variables.leftValue === false || variables.leftValue === 'false';
              break;
            default:
              throw new Error(`Unsupported operator: ${variables.operator}`);

          }

          return result;
        });

        const eventName = conditionalResult ? WORKFLOW_EVENTS.conditional.true : WORKFLOW_EVENTS.conditional.false;

        return this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: eventName, executionId, globalResult: res, localResult: { result: conditionalResult }, workflowId, domain, token });
      },
    },
  });

  constructor(
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
  ) {
    super();
  }
}