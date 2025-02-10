import { ExecutionContext } from '@/components/workflow/server/execute';
import * as cheerio from 'cheerio';
import { DecisionTableNodeData } from '../types';
import { getContextualInjector } from '@/actions/injector';
import { WorkflowExecutionsService, WorkflowsService } from '@/lib/services';
import { sqs } from '@/lib/clients/sqs.client';
import { Resource } from 'sst';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { decisionTable } = require('@hbtgmbh/dmn-eval-js');

/**
 * Filters XML string by removing disallowed nodes.
 *
 * @param {string} xml - The XML string to be filtered.
 * @param {string[]} allowedNodes - An array of node names that should be retained.
 * @returns {string} - The resulting XML string with only allowed nodes.
 */
function filterXmlNodes(xml: string, allowedNodes: string[]) {
  // Load the XML with xmlMode enabled
  const $ = cheerio.load(xml, { xmlMode: true });

  // Select the <definitions> node
  const definitions = $('definitions');

  // Remove all direct children that are not in the allowedNodes list
  definitions.children().each((index, element) => {
    if (!allowedNodes.includes(element.tagName)) {
      $(element).remove();
    }
  });

  // a node with <decision name=risk ></decision>
  const riskNode = definitions.find('decision[name=risk]');
  const riskId = riskNode.attr('id');

  // Return the resulting XML string
  return { xml: $.xml().replace(/<(\/)?(\w+)/g, '<$1dmn:$2'), riskId: riskId };
}

async function evaluateDecisionTable({ xml, targetDmnId: riskId, outputName }: DecisionTableNodeData, context: Record<string, unknown>) {
  const xmlContent = filterXmlNodes(xml, ['decision', 'inputData', 'input', 'output']);

  const decisions = await decisionTable.parseDmnXml(xmlContent);

  const output = decisionTable.evaluateDecision(riskId, decisions, context);

  const result = output[outputName];

  if (!result) {
    throw new Error("Failed to evaluate dmn");
  }

  return result;
}

export const execute = async (nodeId: string, ctx: ExecutionContext) => {
  const {injector} = await getContextualInjector();
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
  const typedConfig = config as unknown as DecisionTableNodeData;

  try {
    const result = await evaluateDecisionTable(typedConfig, nodeExecutionCtx)

    await workflowExecutionService.updateNodeExecutionStatus({
      id: nodeExecution.id,
      status: 'completed',
    });

    await workflowExecutionService.createNodeExecutionEdge({
      executionId: ctx.executionId,
      nodeExecutionId: nodeExecution.id,
      eventName: 'success',
      result,
      error: null,
    });

    const newCtx = {
      domain: ctx.domain,
      executionId: ctx.executionId,
      executionNodeId: nodeExecution.id,
      eventName: 'success',
      triggeredBy: ctx.triggeredBy,
      triggeredByRole: ctx.triggeredByRole,
      workflowId: ctx.workflowId,
    } satisfies ExecutionContext;

    await sqs
      .queue(Resource.ExecutionQueue.url)
      .sendMessage({
        MessageBody: JSON.stringify(newCtx),
        MessageGroupId: ctx.executionId,
        MessageDeduplicationId: `${newCtx.workflowId}::${newCtx.executionId}::${newCtx.executionNodeId}`,
      });

    return result;

  } catch (error) {
    await workflowExecutionService.updateNodeExecutionStatus({
      id: nodeExecution.id,
      status: 'failed',
    });

    await workflowExecutionService.createNodeExecutionEdge({
      executionId: ctx.executionId,
      nodeExecutionId: nodeExecution.id,
      eventName: 'error',
      result: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}