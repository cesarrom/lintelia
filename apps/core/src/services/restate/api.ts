

import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { env } from "../../constants";
import { WorkflowExecutionsService } from "../../services/workflow-executions.service";
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { OutgoingApiNodeConfig, outgoingApiNodeConfigSchema, WORKFLOW_EVENTS } from "@repo/fintivio/schemas";
import { RestateService } from "./restate.abstract.service";
import { Injectable, Inject, Scope } from "@nestjs/common";
@Injectable({
  scope: Scope.REQUEST
})
export class ApiService extends RestateService<'api'> {
  object = object({
    name: "api",
    handlers: {
      executeNode: async (c: ObjectContext, { executionId, nodeData, workflowId, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        const configRef = await c.run('validate-config', async () => {
          return outgoingApiNodeConfigSchema.parse(nodeData.config || {});
        });

        const config = this.workflowExecutionsService.getConfiguration(configRef, r) as OutgoingApiNodeConfig;

        // Create resolvable promise for webhook callback
        const resolvablePromise = c.awakeable<Record<string, unknown>>();

        // Build callback URL with promise ID
        const callbackUrl = `${env.RESTATE_ENDPOINT}/resolvable/${c.key}/resolve?promiseId=${resolvablePromise.id}`;

        try {
          // Make webhook request
          const response = await fetch(config.webhookUrl, {
            method: config.method,
            headers: {
              'Content-Type': 'application/json',
              ...(config.securityHeader && {
                [config.securityHeader]: config.securityValue || ''
              })
            },
            body: JSON.stringify({
              payload: config.payload || {},
              callbackUrl
            })
          });

          if (!response.ok) {
            throw new Error(`Webhook request failed with status ${response.status}`);
          }

          // Wait for callback to resolve promise
          const result = await resolvablePromise.promise;

          return this.workflowExecutionsService.nextOrEndExecution(c, {
            nodeId: nodeData.id,
            event: WORKFLOW_EVENTS.api.success,
            executionId,
            globalResult: r,
            localResult: result,
            workflowId,
            domain,
            token
          });

        } catch (error: any) {
          return this.workflowExecutionsService.nextOrEndExecution(c, {
            nodeId: nodeData.id,
            event: WORKFLOW_EVENTS.api.failed,
            executionId,
            globalResult: r,
            localResult: { error: error.message },
            workflowId,
            domain,
            token
          });
        }
      }
    }
  });

  constructor(
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
  ) {
    super();
  }
}