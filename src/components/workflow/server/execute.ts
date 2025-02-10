'use server';

import { getContextualInjector } from "@/actions/injector";
import { getUser, getUserRoles } from "@/actions/users";
import { sqs } from "@/lib/clients/sqs.client";
import { WorkflowExecutionsService, WorkflowsService } from "@/lib/services";
import { ExecutionContext } from "@/types/schema";
import { Resource } from "sst";
import { yamlToWorkflow } from "../yaml/converter";

/**
 * Execute a workflow
 * @param workflowId - The ID of the workflow to execute
 * @param variables - The variables to pass to the workflow
 * @returns The ID of the execution
 */
export const startWorkflow = async ({ variables, workflowId, executionNodeId }: { variables: Record<string, unknown>, workflowId: string, executionNodeId?: string }) => {
  const { injector, tenant } = await getContextualInjector();
  const user = await getUser();
  const roles = await getUserRoles(user.userId);

  const workflowsService = injector.resolve(WorkflowsService);
  const workflowExecutionService = injector.resolve(WorkflowExecutionsService);

  const { yaml } = await workflowsService.loadWorkflow(workflowId);

  const { workflow, nodes, edges } = yamlToWorkflow(yaml);

  const startNode = nodes.find((node) => node.type === 'start');

  if (!startNode) {
    throw new Error('Start node not found');
  }

  const allowedRoles = workflow.allowedRoles || [];

  const allowedUsers = workflow.allowedUsers || [];

  const hasAccess = allowedRoles.some((role) => roles.some((r) => r.roleId === role)) || allowedUsers.some((userId) => userId === user.userId);

  if (!hasAccess) {
    throw new Error('User does not have access to this workflow');
  }

  const selectedRole = roles.find((r) => allowedRoles.includes(r.roleId));

  const execution = await workflowExecutionService.createExecution({
    workflowId,
    triggeredBy: user.userId,
    triggeredByRole: selectedRole?.roleId,
    executingVersion: 1,
    executionNodeId,
    inputs: variables,
  });

  const configuredStartNode = await workflowExecutionService.resolveConfiguredNode(startNode.id, variables);

  const startNodeExecution = await workflowExecutionService.createNodeExecution({
    executionId: execution.id,
    nodeId: startNode.id,
    executedBy: user.userId,
    executedByRole: selectedRole?.roleId,
    config: configuredStartNode.config,
  });

  await workflowExecutionService.updateNodeExecutionStatus({
    id: startNodeExecution.nodeId,
    status: 'completed',
  });

  const eventName = 'started';

  if (!edges.length) {
    throw new Error('Edges not found');
  }

  for (const edge of edges) {
    await workflowExecutionService.createExecutionListener({
      executionId: execution.id,
      listenerNodeId: edge.target,
      event: edge.sourceHandle,
      sourceId: edge.source,
      sourceType: 'node',
    });
  }

  // triggers execution of all nodes connected to this output event, by creating a new execution edges, and sending messages to the execution queue
  await workflowExecutionService.createNodeExecutionEdge({
    executionId: execution.id,
    nodeExecutionId: startNodeExecution.id,
    eventName,
    result: startNodeExecution.config,
    error: null,
  });

  const newCtx = {
    domain: tenant.domain,
    executionId: execution.id,
    executionNodeId: startNodeExecution.id,
    eventName,
    triggeredBy: user.userId,
    triggeredByRole: selectedRole?.roleId,
    workflowId: workflowId,
  } satisfies ExecutionContext;

  await sqs
    .queue(Resource.ExecutionQueue.url)
    .sendMessage({
      MessageBody: JSON.stringify(newCtx),
      MessageGroupId: execution.id,
      MessageDeduplicationId: `${newCtx.workflowId}::${newCtx.executionId}::${newCtx.executionNodeId}::${eventName}`,
    });

  return execution.id;
};

/**
 * End a workflow
 * @param executionId - The ID of the execution to end
 */
export const endWorkflow = async (executionId: string) => {
  const {injector, tenant} = await getContextualInjector();
  const workflowExecutionService = injector.resolve(WorkflowExecutionsService);
  const workflowService = injector.resolve(WorkflowsService);

  // Get the execution to check if it's a subprocess
  const execution = await workflowExecutionService.getExecution(executionId);

  // Get workflow nodes and edges
  const { yaml } = await workflowService.loadWorkflow(execution.workflowId);

  const { nodes } = yamlToWorkflow(yaml);

  // Find the end node
  const noConfiguredEndNode = nodes.find(n => n.type === 'end');

  if (!noConfiguredEndNode) {
    throw new Error('End node not found');
  }

  const nodeContext = await workflowExecutionService.getNodeExecutionContext(executionId, noConfiguredEndNode.id);

  const endNode = await workflowExecutionService.resolveConfiguredNode(noConfiguredEndNode.id, nodeContext.config);

  // Create end node execution
  const endNodeExecution = await workflowExecutionService.createNodeExecution({
    executionId,
    nodeId: endNode.id,
    config: endNode.config,
  });

  // Complete the end node execution
  await workflowExecutionService.updateNodeExecutionStatus({
    id: endNodeExecution.id,
    status: 'completed',
  });

  // Complete the workflow execution
  await workflowExecutionService.updateExecutionStatus({
    id: executionId,
    status: 'completed',
    outputs: endNode.config,
  });

  // If this is a subprocess (has executionNodeId), trigger the parent workflow to continue
  if (execution.executionNodeId) {
    const parentExecutionNode = await workflowExecutionService.getNodeExecutionById(execution.executionNodeId);
    const executionId = parentExecutionNode.executionId;

    const parentExecution = await workflowExecutionService.getExecution(executionId);

    const eventName = 'completed';

    await workflowExecutionService.createNodeExecutionEdge({
      executionId,
      nodeExecutionId: parentExecutionNode.id,
      eventName,
      result: endNode.config,
      error: null,
    });

    const newCtx = {
      domain: tenant.domain,
      executionId,
      executionNodeId: parentExecutionNode.id,
      eventName,
      triggeredBy: parentExecutionNode.executedBy,
      triggeredByRole: parentExecutionNode.executedByRole,
      workflowId: parentExecution.workflowId,
    } satisfies ExecutionContext;

    await sqs
      .queue(Resource.ExecutionQueue.url)
      .sendMessage({
        MessageBody: JSON.stringify(newCtx),
        MessageGroupId: executionId,
        MessageDeduplicationId: `${newCtx.workflowId}::${newCtx.executionId}::${newCtx.executionNodeId}::${eventName}`,
      });
  }
};