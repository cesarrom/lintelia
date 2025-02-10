'use server';
import { getContextualInjector } from "@/actions/injector";
import { ExecutionContext } from "@/components/workflow/server/execute";
import { WorkflowExecutionsService, WorkflowsService } from "@/lib/services";
import { MapperNodeData } from "../types";
import { sqs } from "@/lib/clients/sqs.client";
import { Resource } from "sst";
import { get } from "lodash";

export const execute = async (nodeId: string, ctx: ExecutionContext) => {
  const { injector } = await getContextualInjector();
  const workflowExecutionService = injector.resolve(WorkflowExecutionsService);
  const workflowService = injector.resolve(WorkflowsService);

  const { nodes, edges } = await workflowService.loadWorkflow(ctx.workflowId);

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
  const typedConfig = config as unknown as MapperNodeData;

  // Get the source object from context using configured path
  const sourceObject = get(nodeExecutionCtx, typedConfig.config.pathToSourceObjectInContext);

  if (!sourceObject) {
    throw new Error(`Path ${typedConfig.config.pathToSourceObjectInContext} does not point to a valid object`);
  }

  // Extract the value using property path
  const mappedValue = get(sourceObject, typedConfig.config.propertyPath);

  // Update node execution status
  await workflowExecutionService.updateNodeExecutionStatus({
    id: nodeExecution.id,
    status: 'completed',
  });

  const eventName = 'mapped';

  const nodeEdges = edges.filter(e => e.source === nodeId && e.sourceHandle === eventName);

  if (!nodeEdges.length) {
    throw new Error('Edge not found');
  }

  for (const edge of nodeEdges) {
    await workflowExecutionService.createNodeExecutionEdge({
      executionId: ctx.executionId,
      nodeExecutionId: nodeExecution.id,
      eventName: edge.sourceHandle,
      result: { value: mappedValue },
      error: null,
    });

    const newCtx = {
      domain: ctx.domain,
      executionId: ctx.executionId,
      executionNodeId: nodeExecution.id,
      eventName: edge.sourceHandle,
      triggeredBy: ctx.triggeredBy,
      triggeredByRole: ctx.triggeredByRole,
      workflowId: ctx.workflowId,
    } satisfies ExecutionContext;

    await sqs
      .queue(Resource.ExecutionQueue.url)
      .sendMessage({
        MessageBody: JSON.stringify(newCtx),
        MessageGroupId: ctx.executionId,
        MessageDeduplicationId: `${newCtx.workflowId}::${newCtx.executionId}::${newCtx.executionNodeId}::${newCtx.eventName}`,
      });
  }

  return { value: mappedValue };
};
