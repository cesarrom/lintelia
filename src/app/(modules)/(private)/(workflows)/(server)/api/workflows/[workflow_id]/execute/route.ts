import { getContextualInjector } from "@/actions/injector";
import { WorkflowExecutionsService, WorkflowsService } from "@/lib/services";
import { execute as executeMapper } from "@/components/workflow/nodes/mapper/server/execute";
import { execute as executeIterator } from "@/components/workflow/nodes/iterator/server/execute";
import { execute as executeConditional } from "@/components/workflow/nodes/conditional/server/execute";
import { execute as executeDatabase } from "@/components/workflow/nodes/database/server/execute";
import { execute as executeDecisionTable } from "@/components/workflow/nodes/decision-table/server/execute";
import { execute as executeDocumentExtractor } from "@/components/workflow/nodes/document-extractor/server/execute";
import { execute as executeEmail } from "@/components/workflow/nodes/email/server/execute";
import { execute as executeForm } from "@/components/workflow/nodes/form/server/execute";
import { execute as executeIdentityValidation } from "@/components/workflow/nodes/identity-validation/server/execute";
import { execute as executeProofOfLife } from "@/components/workflow/nodes/proof-of-life/server/execute";
import { execute as executeScheduler } from "@/components/workflow/nodes/scheduler/server/execute";
import { execute as executeWizard } from "@/components/workflow/nodes/wizard/server/execute";
import { execute as executeWorkflow } from "@/components/workflow/nodes/workflow/server/execute";
import { ExecutionContext } from "@/types/schema";
import { NextRequest } from "next/server";
import { yamlToWorkflow } from "@/components/workflow/yaml/converter";

const executors: Record<string, (nodeId: string, ctx: ExecutionContext) => Promise<unknown>> = {
  conditional: executeConditional,
  database: executeDatabase,
  decisionTable: executeDecisionTable,
  documentExtractor: executeDocumentExtractor,
  email: executeEmail,
  form: executeForm,
  identityValidation: executeIdentityValidation,
  iterator: executeIterator,
  mapper: executeMapper,
  proofOfLife: executeProofOfLife,
  scheduler: executeScheduler,
  wizard: executeWizard,
  workflow: executeWorkflow,
};

const handleExecution = async (ctx: ExecutionContext) => {
  const { domain, executionId, executionNodeId, eventName, triggeredBy, triggeredByRole, workflowId } = ctx;
  const { injector } = await getContextualInjector(domain);

  const workflowExecutionService = injector.resolve(WorkflowExecutionsService);
  const workflowService = injector.resolve(WorkflowsService);
  const executedNode = await workflowExecutionService.getNodeExecutionById(executionNodeId);

  const listeners = await workflowExecutionService.getExecutionListeners(executionId);

  for (const listener of listeners) {
    if (listener.status !== 'waiting') {
      continue;
    }

    if (listener.event !== eventName) {
      continue;
    }

    if (![executedNode.nodeId, executedNode.id].includes(listener.sourceId)) {
      continue;
    }

    const { yaml } = await workflowService.loadWorkflow(workflowId);

    const { nodes } = yamlToWorkflow(yaml);

    if (listener.sourceType === 'node') {
      const node = nodes.find(node => node.id === listener.listenerNodeId);

      const executor = executors[node.type];

      if (!executor) {
        throw new Error(`No executor found for node type: ${node.type}`);
      }

      await executor(node.id, {
        domain,
        executionId,
        executionNodeId: listener.sourceId,
        eventName,
        triggeredBy,
        triggeredByRole,
        workflowId,
        listenerId: listener.id,
      });
    }
  }
}

export const POST = async (req: NextRequest, { params }: { params: { workflow_id: string } }) => {
  const { workflow_id } = params;
  const ctx = await req.json();

  return handleExecution({ ...ctx, workflowId: workflow_id });
}
