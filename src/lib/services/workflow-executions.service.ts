import { inject, injectable } from 'tsyringe';
import { TENANT_DB_TOKEN } from '../injector/tokens';
import { DataSource, In, Repository } from 'typeorm';
import { WorkflowExecution } from '../entities/tenant/workflow-execution.entity';
import { WorkflowNodeExecution } from '../entities/tenant/workflow-node-execution.entity';
import { WorkflowNodeExecutionEdge } from '../entities/tenant/workflow-node-execution-edge.entity';
import { WorkflowExecutionListener } from '../entities/tenant/workflow-execution-listener.entity';
import { WorkflowsService } from './workflows.service';
import { v4 as uuid } from 'uuid';
import hbs from 'handlebars/runtime';
import assert from 'assert';
import { groupBy } from 'lodash';

@injectable()
export class WorkflowExecutionsService {
  private workflowExecutionRepository: Repository<WorkflowExecution>;
  private nodeExecutionRepository: Repository<WorkflowNodeExecution>;
  private nodeExecutionEdgeRepository: Repository<WorkflowNodeExecutionEdge>;
  private executionListenerRepository: Repository<WorkflowExecutionListener>;

  constructor(
    @inject(TENANT_DB_TOKEN) private conn: DataSource,
    @inject(WorkflowsService) private readonly workflowsService: WorkflowsService
  ) {
    this.workflowExecutionRepository = this.conn.getRepository(WorkflowExecution);
    this.nodeExecutionRepository = this.conn.getRepository(WorkflowNodeExecution);
    this.nodeExecutionEdgeRepository = this.conn.getRepository(WorkflowNodeExecutionEdge);
    this.executionListenerRepository = this.conn.getRepository(WorkflowExecutionListener);
  }

  async createExecution(data: CreateExecutionInput): Promise<WorkflowExecution> {
    const execution = new WorkflowExecution();
    execution.id = uuid();
    execution.workflowId = data.workflowId;
    execution.status = 'pending';

    return await this.workflowExecutionRepository.save(execution);
  }

  async updateExecutionStatus(data: UpdateExecutionStatusInput): Promise<WorkflowExecution> {
    const execution = await this.workflowExecutionRepository.findOne({
      where: { id: data.id }
    });

    if (!execution) {
      throw new Error('Execution not found');
    }

    execution.status = data.status;
    if (data.status === 'running' && !execution.startedAt) {
      execution.startedAt = new Date();
    }
    if (['completed', 'failed'].includes(data.status) && !execution.completedAt) {
      execution.completedAt = new Date();
    }

    return await this.workflowExecutionRepository.save(execution);
  }

  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    return await this.workflowExecutionRepository.findOne({
      where: { id: executionId },
      relations: ['workflow']
    });
  }

  async getNodeExecutionById(nodeExecutionId: string): Promise<WorkflowNodeExecution | null> {
    return await this.nodeExecutionRepository.findOne({
      where: { id: nodeExecutionId },
      relations: ['execution', 'executor', 'executorRole']
    });
  }

  async createNodeExecution(data: CreateNodeExecutionInput): Promise<WorkflowNodeExecution> {
    const nodeExecution = new WorkflowNodeExecution();
    nodeExecution.id = uuid();
    nodeExecution.executionId = data.executionId;
    nodeExecution.nodeId = data.nodeId;
    nodeExecution.status = 'pending';
    nodeExecution.executedBy = data.executedBy;
    nodeExecution.executedByRole = data.executedByRole;
    nodeExecution.config = data.config;

    return await this.nodeExecutionRepository.save(nodeExecution);
  }

  async updateNodeExecutionStatus(data: UpdateNodeExecutionStatusInput): Promise<WorkflowNodeExecution> {
    const nodeExecution = await this.nodeExecutionRepository.findOne({
      where: { id: data.id }
    });

    if (!nodeExecution) {
      throw new Error('Node execution not found');
    }

    nodeExecution.status = data.status;
    if (data.status === 'in_progress' && !nodeExecution.startedAt) {
      nodeExecution.startedAt = new Date();
    }
    if (['completed', 'failed'].includes(data.status) && !nodeExecution.completedAt) {
      nodeExecution.completedAt = new Date();
    }

    return await this.nodeExecutionRepository.save(nodeExecution);
  }

  async createNodeExecutionEdge(data: CreateNodeExecutionEdgeInput): Promise<WorkflowNodeExecutionEdge> {
    const edge = new WorkflowNodeExecutionEdge();
    edge.executionId = data.executionId;
    edge.nodeExecutionId = data.nodeExecutionId;
    edge.eventName = data.eventName;
    edge.result = data.result;
    edge.error = data.error || undefined;

    return await this.nodeExecutionEdgeRepository.save(edge);
  }

  async getNodeExecutionEdge(nodeExecutionId: string, eventName: string): Promise<WorkflowNodeExecutionEdge | null> {
    return await this.nodeExecutionEdgeRepository.findOne({
      where: { nodeExecutionId, eventName },
      relations: ['nodeExecution']
    });
  }

  async createExecutionListener(data: CreateExecutionListenerInput): Promise<WorkflowExecutionListener> {
    const listener = new WorkflowExecutionListener();
    listener.id = uuid();
    listener.executionId = data.executionId;
    listener.listenerId = data.listenerNodeId;
    listener.event = data.event;
    listener.sourceId = data.sourceId || '';
    listener.sourceType = data.sourceType;
    listener.status = 'waiting';

    return await this.executionListenerRepository.save(listener);
  }

  async getExecutionListener(listenerId: string): Promise<WorkflowExecutionListener | null> {
    return await this.executionListenerRepository.findOne({
      where: { id: listenerId },
      relations: ['execution']
    });
  }

  async updateExecutionListenerStatus(data: UpdateListenerStatusInput): Promise<WorkflowExecutionListener> {
    const listener = await this.executionListenerRepository.findOne({
      where: { id: data.id }
    });

    if (!listener) {
      throw new Error('Listener not found');
    }

    listener.status = data.status;
    return await this.executionListenerRepository.save(listener);
  }

  async getExecutionListeners(executionId: string): Promise<WorkflowExecutionListener[]> {
    return await this.executionListenerRepository.find({
      where: { executionId },
      relations: ['execution']
    });
  }

  async getNodeExecutionContext(workflowId: string, nodeExecutionId: string): Promise<Record<string, unknown>> {

    const nodes = await this.workflowsService.getWorkflowNodes(workflowId);

    const nodesById = new Map(nodes.map(node => [node.id, node]));

    // First get all node executions in the chain with a recursive CTE
    const nodeExecutionsQuery = `
      WITH RECURSIVE execution_chain AS (
        SELECT id, node_id, previous_node_execution_id
        FROM workflow_node_executions 
        WHERE id = ?
        
        UNION ALL
        
        SELECT wne.id, wne.node_id, wne.previous_node_execution_id
        FROM workflow_node_executions wne
        JOIN execution_chain ec ON wne.id = ec.previous_node_execution_id
      )
      SELECT id FROM execution_chain
    `;

    const nodeExecutionIds = await this.nodeExecutionRepository.query(nodeExecutionsQuery, [nodeExecutionId]) as { id: string }[];

    if (nodeExecutionIds.length === 0) {
      throw new Error('Node execution not found');
    }

    // Get all node executions and their edges in a single query
    const nodeExecutions = await this.nodeExecutionRepository.find({
      where: { id: In(nodeExecutionIds.map(n => n.id)) },
    });

    const nodeExecutionEdges = await this.nodeExecutionEdgeRepository.find({
      where: { nodeExecutionId: In(nodeExecutionIds.map(n => n.id)) },
    });

    const edgesByNodeExecutionId = groupBy(nodeExecutionEdges, 'nodeExecutionId');

    // Build the context object
    const context: Record<string, {
      outputs: Record<string, unknown>;
    }> = {};

    for (const row of nodeExecutions) {
      const nodeId = row.nodeId;
      const node = nodesById.get(nodeId);

      if (!node) {
        continue;
      }

      const nodeName = node.name;

      if (!context[nodeName]) {
        context[nodeName] = {
          outputs: {}
        };
      }

      const edges = edgesByNodeExecutionId[row.id] || [];

      if (edges.length > 0) {
        for (const edge of edges) {
          context[nodeName].outputs[edge.eventName] = edge.result;
        }
      }
    }

    return context;
  }

  async resolveConfiguredNode(nodeId: string, context: Record<string, unknown>) {
    // Get the workflow execution
    const execution = await this.getExecution(context.executionId as string);

    assert(execution, 'Execution not found');
    
    // Get the workflow and parse its YAML
    const nodes = await this.workflowsService.getWorkflowNodes(execution.workflowId);

    // Find the node in the workflow
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error('Node not found');
    }

    // Parse the node config with handlebars
    const configStr = JSON.stringify(node.config || {});
    const template = hbs.compile(configStr);
    const config = JSON.parse(template(context));

    return {
      ...node,
        config
    };
  }
}

interface CreateExecutionInput {
  workflowId: string;
  executionNodeId?: string;
  triggeredBy: string;
  triggeredByRole: string;
  executingVersion: number;
  inputs: Record<string, unknown>;
}

interface UpdateExecutionStatusInput {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

interface CreateNodeExecutionInput {
  executionId: string;
  nodeId: string;
  executedBy?: string;
  executedByRole?: string;
  config: Record<string, unknown>;
}

interface UpdateNodeExecutionStatusInput {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface CreateNodeExecutionEdgeInput {
  executionId: string;
  nodeExecutionId: string;
  eventName: string;
  result: Record<string, unknown> | null;
  error: string | null;
}

interface CreateExecutionListenerInput {
  executionId: string;
  listenerNodeId: string;
  event: string;
  sourceId?: string;
  sourceType: 'node' | 'node_execution';
}

interface UpdateListenerStatusInput {
  id: string;
  status: 'waiting' | 'emitted' | 'failed';
}
