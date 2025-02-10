'use server';

import { getContextualInjector } from "@/actions/injector";
import { ExecutionContext, startWorkflow } from "@/components/workflow/server/execute";
import { WorkflowExecutionsService, WorkflowsService } from "@/lib/services";
import { WorkflowNodeData } from "../types";

export const execute = async (nodeId: string, ctx: ExecutionContext) => {
  const { injector } = await getContextualInjector();
  const workflowExecutionService = injector.resolve(WorkflowExecutionsService);
  const workflowService = injector.resolve(WorkflowsService);

  const { nodes } = await workflowService.loadWorkflow(ctx.workflowId);

  const node = nodes.find(n => n.id === nodeId);

  if (!node) {
    throw new Error('Node not found');
  }

  const nodeExecutionCtx = await workflowExecutionService.getNodeExecutionContext(ctx.executionId, nodeId);

  const configuredNode = await workflowExecutionService.resolveConfiguredNode(nodeId, {
    ...ctx,
    ...nodeExecutionCtx,
  });

  const nodeExecution = await workflowExecutionService.createNodeExecution({
    executionId: ctx.executionId,
    nodeId,
    executedBy: ctx.triggeredBy,
    executedByRole: ctx.triggeredByRole,
    config: configuredNode.config,
  });

  const { config } = configuredNode;
  const typedConfig = config as unknown as WorkflowNodeData;

  // Map input variables based on inputMap configuration
  const subWorkflowInputs: Record<string, unknown> = {};
  for (const [subWorkflowVar, contextVar] of Object.entries(typedConfig.inputMap)) {
    subWorkflowInputs[subWorkflowVar] = nodeExecutionCtx.config[contextVar];
  }

  // Start the sub-workflow execution
  const subWorkflowExecutionId = await startWorkflow({
    workflowId: typedConfig.workflowId,
    variables: subWorkflowInputs,
    executionNodeId: nodeExecution.id
  });

  // Update node execution status to in_progress while sub-workflow runs
  await workflowExecutionService.updateNodeExecutionStatus({
    id: nodeExecution.id,
    status: 'in_progress',
  });

  // The sub-workflow will call back to the parent workflow when complete
  // via the endWorkflow function, which handles creating edges and 
  // triggering next nodes

  return { subWorkflowExecutionId };
};
