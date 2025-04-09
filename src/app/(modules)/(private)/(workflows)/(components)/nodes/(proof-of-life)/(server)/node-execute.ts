

import { events, ProofOfLifeNodeData, ProofOfLifeNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import assert from "assert";
import { ExecutableNode, ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { workflowToYaml, yamlToWorkflow } from "@/app/(modules)/(private)/(workflows)/(components)/yaml/converter";
import { workflowInject } from "@/lib/injector/utils";
import { WorkflowExecutionsService } from "@/lib/services";
import { downloadFile } from "@/app/(modules)/(private)/(shared)/(actions)/files";

const DEFAULT_MIN_CONFIDENCE_SCORE = 0.5;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_DURATION = 60;

const aliveByVideoFile = async (fileBase64: string) => 0.65;

export const proofOfLifeService = restate.object({
  name: "proofOfLife",
  handlers: {
    executeNode: workflowInject(
      [WorkflowExecutionsService],
      async ({ tenant }, [workflowExecutionsService], c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        assert(tenant, 'Tenant is required');

        const configRef = await c.run('validate-config', async () => {
          return ProofOfLifeNodeDataSchema.parse(nodeData.config || {});
        });

        const { minConfidenceScore = DEFAULT_MIN_CONFIDENCE_SCORE, maxAttempts = DEFAULT_MAX_ATTEMPTS, attempt = 1, videoFile } = workflowExecutionsService.getConfiguration(configRef, r) as ProofOfLifeNodeData;
        const { Body: file } = await downloadFile(videoFile);
        const confidenceScore = await aliveByVideoFile(file);
        let passed = confidenceScore >= minConfidenceScore;

        if (passed) {
          return workflowExecutionsService.nextOrEndExecution({ nodeData, event: events.success, executionId, globalResult: r, localResult: { confidenceScore }, yaml, domain, token });
        }

        if (maxAttempts <= attempt) {
          return workflowExecutionsService.nextOrEndExecution({ nodeData, event: events.failure, executionId, globalResult: r, localResult: { confidenceScore }, yaml, domain, token });
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

        return await client.executeNode({ executionId, nodeData, yaml: newYaml, domain, token, result: r, sourceEvent: events.reAttemptUrl }) || {};
      }
    ),
  }
});

export type ProofOfLifeService = typeof proofOfLifeService;