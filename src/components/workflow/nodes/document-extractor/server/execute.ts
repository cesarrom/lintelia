import { getContextualInjector } from '@/actions/injector';
import { WorkflowExecutionsService, WorkflowsService } from '@/lib/services';
import { sqs } from '@/lib/clients/sqs.client';
import { Resource } from 'sst';
import OpenAI from 'openai';
import { downloadFile } from '@/actions/files';
import { getTenant } from '@/actions/tenants';
import { ExecutionContext } from '@/types/schema';

const prompts = {
  ID_DOCUMENTS: `
    Please analyze these ID document images and extract the following information in JSON format.
    
    Return ONLY the JSON object with these fields:
    - documentNumber
    - documentCountryIso (2-letter code) 
    - documentCountryIso3 (3-letter code)
    - nationalityIso (2-letter code)
    - nationalityIso3 (3-letter code)
    - firstName
    - lastName
    - sex (as 'MALE', 'FEMALE', or the actual value)
    - type ('PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENSE', or the actual value)
    - expirationMonth (2 digits)
    - expirationYear (4 digits)
    - expirationDate (in ISO format).
    
    Do not include any additional text or explanations in your response.
  `,
};

export const execute = async (nodeId: string, ctx: ExecutionContext) => {
  const {injector} = await getContextualInjector();
  const tenant = await getTenant();
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


  try {
    // If no fileId is present, this is the initial step to get upload URL
    if (listener.sourceType === 'node_execution') {
      const publicUrl = `${process.env.NEXT_PUBLIC_URL}/workflows/${ctx.workflowId}/executions/${ctx.executionId}/nodes/${nodeExecution.id}/document-extractor`;

      await workflowExecutionService.createNodeExecutionEdge({
        executionId: ctx.executionId,
        nodeExecutionId: nodeExecution.id,
        eventName: 'public_url',
        result: { url: publicUrl },
        error: null,
      });

      const newCtx = {
        ...ctx,
        executionNodeId: nodeExecution.id,
        eventName: 'public_url',
        triggeredBy: ctx.triggeredBy,
        triggeredByRole: ctx.triggeredByRole,
        workflowId: ctx.workflowId,
      } satisfies ExecutionContext;

      sqs
        .queue(Resource.ExecutionQueue.url)
        .sendMessage({
          MessageBody: JSON.stringify(newCtx),
          MessageGroupId: ctx.executionId,
          MessageDeduplicationId: `${newCtx.workflowId}::${newCtx.executionId}::${newCtx.executionNodeId}`,
        });

      // we create a listener for this node, called 'uploaded', we will use this event to complete this node's execution later
      await workflowExecutionService.createExecutionListener({
        executionId: ctx.executionId,
        listenerNodeId: nodeExecution.nodeId,
        event: 'uploaded',
        sourceId: nodeExecution.id,
        sourceType: 'resume_node_execution',
      });

      return publicUrl;
    }

    const output = await workflowExecutionService.getNodeExecutionEdge(nodeExecution.id, 'uploaded');

    const { fileId } = output.result;

    // If fileId exists, process the document with OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const file = await downloadFile(tenant.domain, fileId as string);

    const chatCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompts.ID_DOCUMENTS,
            },
            {
              type: 'image_url',
              image_url: {
                url: file.Body,
                detail: 'auto',
              },
            },
          ],
        }
      ],
      model: 'gpt-4-vision-preview',
      stream: false,
    });

    const reply = chatCompletion.choices[0].message.content;
    const result = JSON.parse(reply);

    await workflowExecutionService.updateNodeExecutionStatus({
      id: nodeExecution.id,
      status: 'completed',
    });

    await workflowExecutionService.createNodeExecutionEdge({
      executionId: ctx.executionId,
      nodeExecutionId: nodeExecution.id,
      eventName: 'done',
      result,
      error: null,
    });

    const newCtx = {
      domain: ctx.domain,
      executionId: ctx.executionId,
      executionNodeId: nodeExecution.id,
      eventName: 'done',
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
};