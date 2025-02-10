import { Autowire, Injectable } from 'ts-injection';
import { workflowExecutions, workflowNodeExecutions, workflowNodeExecutionsEdges, workflowExecutionListeners } from '@/lib/models/platform.sql';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { PLATFORM_DB_TOKEN } from '../injector/tokens';
import { type PlatformDB } from './tenants.service';
import * as hbs from 'handlebars';
import { WorkflowsService } from './workflows.service';
import { yamlToWorkflow } from '@/components/workflow/yaml/converter';
import { sql, type SQL } from 'drizzle-orm';

@Injectable()
export class WorkflowExecutionsService {
  @Autowire(PLATFORM_DB_TOKEN)
  private readonly db: PlatformDB;

  @Autowire(WorkflowsService)
  private readonly workflowsService: WorkflowsService;

  async createExecution({
    workflowId,
    executionNodeId,
    triggeredBy,
    triggeredByRole,
    executingVersion,
    inputs,
  }: {
    workflowId: string;
    executionNodeId?: string;
    triggeredBy: string;
    triggeredByRole: string;
    executingVersion: number;
    inputs: Record<string, unknown>;
  }) {
    return await this.db.transaction(async (tx) => {
      const [execution] = await tx
        .insert(workflowExecutions)
        .values({
          workflowId: sql`${workflowId}`,
          triggeredBy: sql`${triggeredBy}`,
          triggeredByRole: sql`${triggeredByRole}`,
          executingVersion: sql`${executingVersion}`,
          executionNodeId: executionNodeId ? sql`${executionNodeId}` : null,
          status: sql`pending`,
          inputs: sql`${JSON.stringify(inputs)}`,
        } as any)
        .returning();

      return execution;
    });
  }

  async updateExecutionStatus({
    id,
    status,
    outputs,
  }: {
    id: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    outputs?: Record<string, unknown>;
  }) {
    const updates: Record<string, SQL<unknown>> = {
      status: sql`${status}`,
      updatedAt: sql`${new Date().getTime()}`,
    };

    if (outputs) {
      updates.outputs = sql`${JSON.stringify(outputs)}`;
    }

    if (['completed', 'failed'].includes(status)) {
      updates.completedAt = sql`${new Date().getTime()}`;
    }

    if (status === 'in_progress') {
      updates.startedAt = sql`${new Date().getTime()}`;
    }

    return await this.db
      .update(workflowExecutions)
      .set(updates as any)
      .where(eq(workflowExecutions.id, id));
  }

  async getExecution(executionId: string) {
    const [execution] = await this.db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, executionId));

    if (!execution) {
      throw new Error('Execution not found');
    }

    return execution;
  }

  async getNodeExecutionById(nodeExecutionId: string) {
    const [nodeExecution] = await this.db
      .select()
      .from(workflowNodeExecutions)
      .where(and(eq(workflowNodeExecutions.id, nodeExecutionId)));

    return nodeExecution;
  }

  async createNodeExecution({
    executionId,
    nodeId,
    executedBy,
    executedByRole,
    config,
  }: {
    executionId: string;
    nodeId: string;
    executedBy?: string;
    executedByRole?: string;
    config: Record<string, unknown>;
  }) {
    return await this.db.transaction(async (tx) => {
      const [nodeExecution] = await tx
        .insert(workflowNodeExecutions)
        .values({
          executionId,
          nodeId,
          executedBy,
          executedByRole,
          status: 'pending',
          config: sql`${JSON.stringify(config)}`,
        })
        .returning();

      return nodeExecution;
    });
  }

  async updateNodeExecutionStatus(
    {
      id,
      status,
      result,
    }: {
      id: string,
      status: 'pending' | 'in_progress' | 'completed' | 'failed',
      result?: Record<string, unknown>,
    }
  ) {
    const now = Date.now();

    return await this.db.transaction(async (tx) => {
      const [nodeExecution] = await tx
        .update(workflowNodeExecutions)
        .set({
          status: sql`${status}`,
          startedAt: status === 'in_progress' ? sql`${now}` : undefined,
          completedAt: ['completed', 'failed'].includes(status) ? sql`${now}` : undefined,
        })
        .where(eq(workflowNodeExecutions.id, id))
        .returning();

      if (result && nodeExecution) {
        await tx
          .insert(workflowNodeExecutionsEdges)
          .values({
            executionId: nodeExecution.executionId,
            nodeExecutionId: nodeExecution.id,
            eventName: 'completed',
            result: sql`${JSON.stringify(result)}`,
          });
      }

      return nodeExecution;
    });
  }

  async createNodeExecutionEdge({
    executionId,
    nodeExecutionId,
    eventName,
    result,
    error,
  }: {
    executionId: string;
    nodeExecutionId: string;
    result: Record<string, unknown>;
    error: string | null;
    eventName: string;
  }) {
    return await this.db.transaction(async (tx) => {
      const [edge] = await tx
        .insert(workflowNodeExecutionsEdges)
        .values({
          executionId,
          nodeExecutionId,
          eventName,
          result: sql`${JSON.stringify(result)}`,
          error: error ? sql`${error}` : null,
        })
        .returning();

      return edge;
    });
  }

  async getNodeExecutionEdge(nodeExecutionId: string, eventName: string) {
    const [edge] = await this.db
      .select()
      .from(workflowNodeExecutionsEdges)
      .where(and(
        eq(workflowNodeExecutionsEdges.nodeExecutionId, nodeExecutionId),
        eq(workflowNodeExecutionsEdges.eventName, eventName)
      ));

    return edge;
  }

  async createExecutionListener({
    executionId,
    listenerNodeId,
    event,
    sourceId,
    sourceType,
  }: {
    executionId: string;
    listenerNodeId: string;
    event: string;
    sourceId?: string;
    sourceType: 'node' | 'node_execution';
  }) {
    return await this.db.transaction(async (tx) => {
      const [listener] = await tx
        .insert(workflowExecutionListeners)
        .values({
          executionId,
          listenerNodeId,
          event,
          sourceId,
          sourceType: sql`${sourceType}`,
          status: 'waiting',
        })
        .returning();

      return listener;
    });
  }

  async getExecutionListener(listenerId: string) {
    const [listener] = await this.db
      .select()
      .from(workflowExecutionListeners)
      .where(eq(workflowExecutionListeners.id, listenerId));

    return listener;
  }

  async updateExecutionListenerStatus({
    id,
    status,
  }: {
    id: string;
    status: 'waiting' | 'emitted' | 'failed';
  }) {
    return await this.db.transaction(async (tx) => {
      const [listener] = await tx
        .update(workflowExecutionListeners)
        .set({ status: sql`${status}` })
        .where(eq(workflowExecutionListeners.id, id))
        .returning();

      return listener;
    });
  }

  async getExecutionListeners(executionId: string) {
    return await this.db
      .select()
      .from(workflowExecutionListeners)
      .where(eq(workflowExecutionListeners.executionId, executionId));
  }

  async getNodeExecutionContext(executionId: string, nodeId: string) {
    // Get the workflow execution
    const execution = await this.getExecution(executionId);
    
    // Get the workflow and parse its YAML
    const workflow = await this.workflowsService.loadWorkflow(execution.workflowId);
    const { nodes, edges } = yamlToWorkflow(workflow.yaml);

    // Get all completed node executions for this workflow execution
    const nodeExecutions = await this.db
      .select()
      .from(workflowNodeExecutions)
      .where(
        and(
          eq(workflowNodeExecutions.executionId, executionId),
          eq(workflowNodeExecutions.status, 'completed')
        )
      );

    // Get all execution edges
    const executionEdges = await this.db
      .select()
      .from(workflowNodeExecutionsEdges)
      .where(eq(workflowNodeExecutionsEdges.executionId, executionId));

    // Build map of target -> source nodes from the workflow definition
    const edgeMap = new Map<string, string[]>();
    for (const edge of edges) {
      if (!edgeMap.has(edge.target)) {
        edgeMap.set(edge.target, []);
      }
      edgeMap.get(edge.target)?.push(edge.source);
    }

    // Helper to recursively find connected nodes
    const findConnectedNodes = (targetId: string, visited = new Set<string>()): Set<string> => {
      if (visited.has(targetId)) {
        return visited;
      }

      visited.add(targetId);

      const sources = edgeMap.get(targetId) || [];
      for (const source of sources) {
        findConnectedNodes(source, visited);
      }

      return visited;
    };

    // Get all nodes connected to our target node
    const connectedNodes = findConnectedNodes(nodeId);

    // Build context from completed executions
    const context: Record<string, Record<string, unknown>> = {};

    for (const node of nodes) {
      if (!connectedNodes.has(node.id)) continue;

      const nodeExecution = nodeExecutions.find(ne => ne.nodeId === node.id);
      if (!nodeExecution) continue;

      const executionEdge = executionEdges.find(e => 
        e.nodeExecutionId === nodeExecution.id
      );

      if (executionEdge?.result) {
        context[node.data.name] = context[node.data.name] || {};
        context[node.data.name]['result'] = executionEdge.result;
      }
    }

    return context;
  }

  async resolveNextNodes(executionId: string) {
    // Get the workflow execution
    const execution = await this.getExecution(executionId);
    
    // Get the workflow and parse its YAML
    const workflow = await this.workflowsService.loadWorkflow(execution.workflowId);
    const { nodes, edges } = yamlToWorkflow(workflow.yaml);

    // Get the currently executing node
    const [currentExecution] = await this.db
      .select()
      .from(workflowNodeExecutions)
      .where(
        and(
          eq(workflowNodeExecutions.executionId, executionId),
          eq(workflowNodeExecutions.status, 'in_progress')
        )
      );

    if (!currentExecution) {
      throw new Error('No running node execution found');
    }

    // Get all edges where current node is the source
    const nextEdges = edges.filter(edge => edge.source === currentExecution.nodeId);

    // Get all potential next nodes
    const nextNodes = nodes.filter(node => 
      nextEdges.some(edge => edge.target === node.id)
    );

    // For each potential next node, check if all its prerequisites are completed
    const readyNodes = await Promise.all(nextNodes.map(async node => {
      // Get all edges targeting this node
      const incomingEdges = edges.filter(edge => edge.target === node.id);

      // Get executions for all source nodes
      const prerequisites = await Promise.all(incomingEdges.map(edge =>
        this.db
          .select()
          .from(workflowNodeExecutions)
          .where(
            and(
              eq(workflowNodeExecutions.executionId, executionId),
              eq(workflowNodeExecutions.nodeId, edge.source)
            )
          )
          .then(execs => execs[0])
      ));

      // Node is ready if all prerequisites are completed
      const isReady = prerequisites.every(pre => pre?.status === 'completed');

      return isReady ? node : null;
    }));

    // Filter out null values and return ready nodes
    return readyNodes.filter((node): node is typeof node => node !== null);
  }

  async resolveConfiguredNode(nodeId: string, context: Record<string, unknown>) {
    // Get the workflow execution
    const execution = await this.getExecution(context.executionId as string);
    
    // Get the workflow and parse its YAML
    const workflow = await this.workflowsService.loadWorkflow(execution.workflowId);
    const { nodes } = yamlToWorkflow(workflow.yaml);

    // Find the node in the workflow
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error('Node not found');
    }

    // Parse the node config with handlebars
    const configStr = JSON.stringify(node.data.config || {});
    const template = hbs.compile(configStr);
    const config = JSON.parse(template(context));

    return {
      ...node,
      data: {
        ...node.data,
        config
      }
    };
  }

  async getLastExecutedNode(executionId: string) {
    const [nodeExecution] = await this.db
      .select()
      .from(workflowNodeExecutions)
      .where(
        and(
          eq(workflowNodeExecutions.executionId, executionId),
          eq(workflowNodeExecutions.status, 'completed')
        )
      )
      .orderBy(desc(workflowNodeExecutions.createdAt))
      .limit(1);

    return nodeExecution;
  }
}
