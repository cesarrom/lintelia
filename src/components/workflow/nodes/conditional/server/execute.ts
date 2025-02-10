'use server';
import { getContextualInjector } from "@/actions/injector";
import { WorkflowExecutionsService, WorkflowsService } from "@/lib/services";
import { ConditionalNodeData } from "../types";
import { sqs } from "@/lib/clients/sqs.client";
import { Resource } from "sst";
import { ExecutionContext } from "@/types/schema";

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

  const typedConfig = config as unknown as ConditionalNodeData;

  let result = false;

  // Handle different operator types
  switch (typedConfig.operator) {
    case 'equals':
      result = typedConfig.leftValue === typedConfig.rightValue;
      break;
    case 'notEquals':
      result = typedConfig.leftValue !== typedConfig.rightValue;
      break;
    case 'greaterThan':
      result = Number(typedConfig.leftValue) > Number(typedConfig.rightValue);
      break;
    case 'greaterThanOrEqual':
      result = Number(typedConfig.leftValue) >= Number(typedConfig.rightValue);
      break;
    case 'lessThan':
      result = Number(typedConfig.leftValue) < Number(typedConfig.rightValue);
      break;
    case 'lessThanOrEqual':
      result = Number(typedConfig.leftValue) <= Number(typedConfig.rightValue);
      break;
    case 'contains':
      result = String(typedConfig.leftValue).includes(String(typedConfig.rightValue));
      break;
    case 'notContains':
      result = !String(typedConfig.leftValue).includes(String(typedConfig.rightValue));
      break;
    case 'startsWith':
      result = String(typedConfig.leftValue).startsWith(String(typedConfig.rightValue));
      break;
    case 'endsWith':
      result = String(typedConfig.leftValue).endsWith(String(typedConfig.rightValue));
      break;
    case 'matches':
      result = new RegExp(String(typedConfig.rightValue)).test(String(typedConfig.leftValue));
      break;
    case 'isNull':
      result = typedConfig.leftValue === null;
      break;
    case 'isNotNull':
      result = typedConfig.leftValue !== null;
      break;
    case 'isEmpty':
      result = !typedConfig.leftValue || String(typedConfig.leftValue).trim() === '';
      break;
    case 'isNotEmpty':
      result = !!typedConfig.leftValue && String(typedConfig.leftValue).trim() !== '';
      break;
    case 'isTrue':
      result = typedConfig.leftValue === true || typedConfig.leftValue === 'true';
      break;
    case 'isFalse':
      result = typedConfig.leftValue === false || typedConfig.leftValue === 'false';
      break;
    default:
      throw new Error(`Unsupported operator: ${typedConfig.operator}`);

  }

  // Update the node execution with the result
  await workflowExecutionService.updateNodeExecutionStatus({
    id: nodeExecution.id,
    status: 'completed',
  });

  const eventName = result ? 'true' : 'false';

  await workflowExecutionService.createNodeExecutionEdge({
    executionId: ctx.executionId,
    nodeExecutionId: nodeExecution.id,
    eventName,
    result: { condition: result },
    error: null,
  });

  const newCtx = {
    domain: ctx.domain,
    executionId: ctx.executionId,
    executionNodeId: nodeExecution.id,
    eventName,
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

  return { condition: result };

}