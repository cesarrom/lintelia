'use server';
import { getContextualInjector } from "@/actions/injector";
import { ExecutionContext } from "@/components/workflow/server/execute";
import { WorkflowExecutionsService, WorkflowsService } from "@/lib/services";
import { IteratorNodeData } from "../types";
import { sqs } from "@/lib/clients/sqs.client";
import { Resource } from "sst";
import { get } from "lodash";

export const execute = async (nodeId: string, ctx: ExecutionContext) => {
  const {injector} = await getContextualInjector();
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
  const typedConfig = config as unknown as IteratorNodeData;

  // Get the array to iterate over from the context using the configured path
  const arrayToIterate = get(nodeExecutionCtx, typedConfig.config.pathToArrayInContext, []);

  if (!Array.isArray(arrayToIterate)) {
    throw new Error(`Path ${typedConfig.config.pathToArrayInContext} does not point to an array`);
  }

  const eventName = 'item';

  const nodeEdges = edges.filter(e => e.source === nodeId && e.sourceHandle === eventName);

  if (!nodeEdges.length) {
    throw new Error('Edges not found');
  }

  for (let index = 0; index < arrayToIterate.length; index++) {
    const eventName = 'item::' + index;

    for (const edge of nodeEdges) {
      await workflowExecutionService.createExecutionListener({
        executionId: ctx.executionId,
        listenerNodeId: edge.target,
        event: eventName,
        sourceId: nodeExecution.nodeId,
        sourceType: 'node',
      });
    }

    const item = arrayToIterate[index];

    await workflowExecutionService.createNodeExecutionEdge({
      executionId: ctx.executionId,
      nodeExecutionId: nodeExecution.id,
      eventName: 'item::' + index,
      result: {
        item,
        index,
      },
      error: null,
    });

    const newCtx = {
      domain: ctx.domain,
      executionId: ctx.executionId,
      executionNodeId: nodeExecution.id,
      eventName: 'item::' + index,
      triggeredBy: ctx.triggeredBy,
      triggeredByRole: ctx.triggeredByRole,
      workflowId: ctx.workflowId,
    } satisfies ExecutionContext;

    await sqs
      .queue(Resource.ExecutionQueue.url)
      .sendMessage({
        MessageBody: JSON.stringify(newCtx),
        MessageGroupId: ctx.executionId,
        MessageDeduplicationId: `${newCtx.workflowId}::${newCtx.executionId}::${newCtx.executionNodeId}::${eventName}`,
      });
  }

  // Update node execution status
  await workflowExecutionService.updateNodeExecutionStatus({
    id: nodeExecution.id,
    status: 'completed',
  });

  return {
    iterationCount: arrayToIterate.length
  };
};
