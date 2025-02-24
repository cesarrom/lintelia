

import { events, ProofOfLifeNodeData, ProofOfLifeNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { getConfiguration, nextOrEndExecution } from "@/lib/restate-utils";
import assert from "assert";
import { ExecutableNode, ExecuteNodeFunctionProps } from "../../(workflows)/types";
import { Tenant } from "@/lib/entities/global";
import { getInjector } from "@/lib/injector";
import { TENANT_TOKEN } from "@/lib/injector/tokens";
import { workflowToYaml, yamlToWorkflow } from "../../(workflows)/(components)/yaml/converter";

const DEFAULT_MIN_CONFIDENCE_SCORE = 0.5;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_DURATION = 60;

export const proofOfLifeService = restate.object({
  name: "proofOfLife",
  handlers: {
    executeNode: async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
      const injector = await getInjector(domain);
      const tenant: Tenant = injector.resolve(TENANT_TOKEN);
      assert(tenant, 'Tenant is required');
      const configRef = await c.run('validate-config', async () => {
        return ProofOfLifeNodeDataSchema.parse(nodeData.config || {});
      });

      const { minConfidenceScore = DEFAULT_MIN_CONFIDENCE_SCORE, maxAttempts = DEFAULT_MAX_ATTEMPTS, timeoutDuration = DEFAULT_TIMEOUT_DURATION, requireLocation, requireDeviceInfo, attempt = 1 } = await getConfiguration(c, executionId, configRef, r) as ProofOfLifeNodeData;

      // Create resolvable promise for document upload URL
      const resolvablePromise = c.awakeable<{ confidenceScore: number, location?: string, deviceInfo?: string }>();

      const publicUrl = `${process.env.NEXT_PUBLIC_URL}/proof-of-life?promiseId=${resolvablePromise.id}&timeoutDuration=${timeoutDuration}&requireLocation=${requireLocation}&requireDeviceInfo=${requireDeviceInfo}`;

      await nextOrEndExecution(c, { nodeData, event: attempt === 1 ? events.publicUrl : events.reAttemptUrl, executionId, globalResult: r, localResult: { url: publicUrl }, yaml, domain, token });

      // Wait for user to upload images
      const { confidenceScore, location, deviceInfo } = await resolvablePromise.promise;

      let passed = confidenceScore >= minConfidenceScore;

      if (!location && requireLocation) {
        passed = false;
      }

      if (!deviceInfo && requireDeviceInfo) {
        passed = false;
      }

      if (passed) {
        return nextOrEndExecution(c, { nodeData, event: events.success, executionId, globalResult: r, localResult: { confidenceScore, location, deviceInfo }, yaml, domain, token });
      }

      if (maxAttempts <= attempt) {
        return nextOrEndExecution(c, { nodeData, event: events.failure, executionId, globalResult: r, localResult: { confidenceScore, location, deviceInfo }, yaml, domain, token });
      }

      // re attempt is by calling ourselves again, but with a decremented maxAttempts
      const client = c.objectClient<ExecutableNode>({ name: nodeData.type }, c.key) as { executeNode: (p: ExecuteNodeFunctionProps) => Promise<Record<string, unknown>> };

      const workflow = yamlToWorkflow(yaml);
      
      for (const node of workflow.nodes) {
        if (node.data.id === nodeData.id) {
          node.data.config = node.data.config ?? {};
          node.data.config.attempt = attempt + 1;
        }
      }

      const newYaml = workflowToYaml(workflow.workflow, workflow.nodes, workflow.edges, workflow.triggers);

      return await client.executeNode({ executionId, nodeData, yaml: newYaml, domain, token, result: r, }) || {};
    }
  }
});

export type ProofOfLifeService = typeof proofOfLifeService;