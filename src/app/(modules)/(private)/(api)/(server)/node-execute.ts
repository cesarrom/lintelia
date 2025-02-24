

import { ApiNodeData, ApiNodeDataSchema, events } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { getConfiguration, nextOrEndExecution } from "@/lib/restate-utils";
import { ExecuteNodeFunctionProps } from "../../(workflows)/types";
import { env } from "@/lib/constants";

export const apiService = restate.object({
  name: "api",
  handlers: {
    executeNode: async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
      const configRef = await c.run('validate-config', async () => {
        return ApiNodeDataSchema.parse(nodeData.config || {});
      });

      const config = await getConfiguration(c, executionId, configRef, r) as ApiNodeData;

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

        return nextOrEndExecution(c, { 
          nodeData, 
          event: events.success, 
          executionId,
          globalResult: r,
          localResult: result,
          yaml,
          domain,
          token 
        });

      } catch (error: any) {
        return nextOrEndExecution(c, {
          nodeData,
          event: events.failed,
          executionId, 
          globalResult: r,
          localResult: { error: error.message },
          yaml,
          domain,
          token
        });
      }
    }
  }
});

export type ApiService = typeof apiService;