import { getContextualInjector } from "@/actions/injector";
import { ExecutionContext } from "@/components/workflow/server/execute";
import { dynamo } from "@/lib/clients/dynamo.client";
import { WorkflowExecutionsService, WorkflowsService } from "@/lib/services";
import { Resource } from "sst";
import { SchedulerNodeData } from "../types";
import { sqs } from "@/lib/clients/sqs.client";

export const execute = async (nodeId: string, ctx: ExecutionContext) => {
  const {injector} = await getContextualInjector(ctx.domain);
  const workflowExecutionService = injector.resolve(WorkflowExecutionsService);
  const workflowService = injector.resolve(WorkflowsService);

  const { nodes } = await workflowService.loadWorkflow(ctx.workflowId);
  const node = nodes.find(n => n.id === nodeId);

  if (!node) {
    throw new Error('Node not found');
  }

  const listener = await workflowExecutionService.getExecutionListener(ctx.listenerId);
  const nodeExecutionCtx = await workflowExecutionService.getNodeExecutionContext(ctx.executionId, nodeId);
  const configuredNode = await workflowExecutionService.resolveConfiguredNode(nodeId, {
    ...ctx,
    ...nodeExecutionCtx,
  });

  const nodeExecution = listener.sourceType !== 'node_execution' ? await workflowExecutionService.createNodeExecution({
    executionId: ctx.executionId,
    nodeId,
    executedBy: ctx.triggeredBy,
    executedByRole: ctx.triggeredByRole,
    config: configuredNode.config,
  }) : await workflowExecutionService.getNodeExecutionById(listener.sourceId);

  const nodeConfig = configuredNode.config as SchedulerNodeData;

  // If this is the initial execution (not triggered by timer expiry)
  if (listener.sourceType !== 'node_execution') {
    let expiresAt = 0;

    if (nodeConfig.type === 'absolute') {
      expiresAt = new Date(nodeConfig.scheduledDate).getTime() / 1000;
    } else {
      let multiplier = 1;

      if (nodeConfig.unit === 'minutes') {
        multiplier = 60;
      } else if (nodeConfig.unit === 'hours') {
        multiplier = 3600;
      } else if (nodeConfig.unit === 'days') {
        multiplier = 86400;
      } else if (nodeConfig.unit === 'weeks') {
        multiplier = 604800;
      } else if (nodeConfig.unit === 'months') {
        multiplier = 2629746;
      } else if (nodeConfig.unit === 'years') {
        multiplier = 31556952;
      }

      expiresAt = Math.floor(Date.now() / 1000) + (nodeConfig.amount * multiplier);
    }

    // Create dynamo record that will expire
    await dynamo.table(Resource.DynamoScheduler.name).putItem({
      Item: {
        domain: { S: ctx.domain },
        workflowId: { S: ctx.workflowId },
        executionId: { S: ctx.executionId },
        executionNodeId: { S: nodeExecution.id },
        eventName: { S: 'internal_timer_end' },
        triggeredBy: { S: ctx.triggeredBy },
        triggeredByRole: { S: ctx.triggeredByRole },
        listenerId: { S: nodeExecution.id },
        expiresAt: { N: expiresAt.toString() }
      }
    });

    // Create execution edge for timer start
    await workflowExecutionService.createNodeExecutionEdge({
      executionId: ctx.executionId,
      nodeExecutionId: nodeExecution.id,
      eventName: 'on_timer_start',
      result: { expiresAt },
      error: null,
    });

    await workflowExecutionService.createExecutionListener({
      executionId: ctx.executionId,
      listenerNodeId: nodeExecution.nodeId,
      event: 'internal_timer_end',
      sourceId: nodeExecution.id,
      sourceType: 'node_execution',
    });

    const newCtx = {
      domain: ctx.domain,
      executionId: ctx.executionId,
      executionNodeId: nodeExecution.id,
      eventName: 'on_timer_start',
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

    return { status: 'timer_started' };
  }

  const eventName = 'on_timer_end';

  // If triggered by timer expiry
  await workflowExecutionService.updateNodeExecutionStatus({
    id: nodeExecution.id,
    status: 'completed',
  });

  await workflowExecutionService.createNodeExecutionEdge({
    executionId: ctx.executionId,
    nodeExecutionId: nodeExecution.id,
    eventName,
    result: { status: eventName },
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
      MessageDeduplicationId: `${newCtx.workflowId}::${newCtx.executionId}::${newCtx.executionNodeId}::${newCtx.eventName}`,
    });

  return { status: eventName };
};