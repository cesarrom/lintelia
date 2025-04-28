import { inject, injectable } from 'tsyringe';
import { DataSource, ObjectLiteral, Repository } from 'typeorm';
import { Workflow } from '../entities';
import { WorkflowTrigger } from '../entities';
import { LogsService } from './logs.service';
import { v4 as uuid } from 'uuid';
import { validateWorkflowYaml, yamlToWorkflow } from '@/app/(modules)/(private)/(workflows)/(components)/yaml/converter';
import { type NodeData } from '@/app/(modules)/(private)/(workflows)/(components)/yaml/types';
import yaml from 'yaml';
import { TenantsService } from './tenants.service';
import { Newable, Service } from './service';

@injectable()
export class WorkflowsService extends Service {
  private conn: DataSource | null = null;
  private repositories: Map<Newable<any>, Repository<any>> = new Map();

  static dependencies() {
    return [
      TenantsService,
      LogsService
    ]
  }


  constructor(
    @inject(TenantsService) private tenantsService: TenantsService,
    @inject(LogsService) private logs: LogsService
  ) { super(); }


  async getConnection(): Promise<DataSource> {
    if (this.conn) return this.conn;
    this.conn = await this.tenantsService.getContextualPlatformDBClient();
    return this.conn;
  }


  async getRepository<T extends ObjectLiteral>(cls: Newable<T>): Promise<Repository<T>> {
    if (this.repositories.has(cls)) {
      return this.repositories.get(cls)!;
    }
    const conn = await this.getConnection();
    const repository = conn.getRepository(cls);
    this.repositories.set(cls, repository);
    return repository! as any;
  }

  async saveWorkflow(data: SaveWorkflowInput): Promise<Workflow> {
    const workflowRepository = await this.getRepository(Workflow);
    // Validate YAML format and schema
    if (!validateWorkflowYaml(data.yaml)) {
      await this.logs.error('Invalid workflow YAML', {
        category: 'workflow',
        source: 'WorkflowsService',
        userId: data.createdBy,
        metadata: { yaml: data.yaml }
      });
      throw new Error('Invalid workflow YAML');
    }

    // Parse YAML to extract metadata
    const { workflow: parsedWorkflow, triggers } = yamlToWorkflow(data.yaml);


    // Create workflow
    const workflow = new Workflow();
    workflow.id = parsedWorkflow.id || uuid();
    workflow.name = parsedWorkflow.name;
    workflow.description = parsedWorkflow.description;
    const parsedYaml = yaml.parse(data.yaml);
    parsedYaml.id = workflow.id;
    workflow.yaml = yaml.stringify(parsedYaml);
    workflow.allowedRoles = parsedWorkflow.allowedRoles || [];
    workflow.allowedUsers = parsedWorkflow.allowedUsers || [];
    workflow.createdBy = data.createdBy;

    // Save workflow first
    const savedWorkflow = await workflowRepository.save(workflow);

    await this.logs.info('Workflow created', {
      category: 'workflow',
      source: 'WorkflowsService',
      userId: data.createdBy,
      metadata: {
        workflowId: savedWorkflow.id,
        workflowName: workflow.name,
        triggerCount: triggers.length,
        allowedRoles: workflow.allowedRoles,
        allowedUsers: workflow.allowedUsers
      }
    });

    return savedWorkflow;
  }

  async updateWorkflow(workflowId: string, data: UpdateWorkflowInput): Promise<Workflow> {
    const workflowRepository = await this.getRepository(Workflow);
    const workflowTriggerRepository = await this.getRepository(WorkflowTrigger);
    const workflow = await workflowRepository.findOne({
      where: { id: workflowId }
    });

    if (!workflow) {
      await this.logs.warning('Workflow update attempted on non-existent workflow', {
        category: 'workflow',
        source: 'WorkflowsService',
        metadata: { workflowId }
      });
      throw new Error('Workflow not found');
    }

    // Validate new YAML
    if (!validateWorkflowYaml(data.yaml)) {
      await this.logs.error('Invalid workflow YAML in update', {
        category: 'workflow',
        source: 'WorkflowsService',
        metadata: {
          workflowId,
          yaml: data.yaml
        }
      });
      throw new Error('Invalid workflow YAML');
    }

    // Parse YAML to extract metadata
    const { workflow: parsedWorkflow, triggers } = yamlToWorkflow(data.yaml);

    // Update workflow
    workflow.name = parsedWorkflow.name;
    workflow.description = parsedWorkflow.description;
    const parsedYaml = yaml.parse(data.yaml);
    parsedYaml.id = workflow.id;
    workflow.yaml = yaml.stringify(parsedYaml);
    workflow.allowedRoles = parsedWorkflow.allowedRoles || [];
    workflow.allowedUsers = parsedWorkflow.allowedUsers || [];

    // Save workflow
    const savedWorkflow = await workflowRepository.save(workflow);

    await this.logs.info('Workflow updated', {
      category: 'workflow',
      source: 'WorkflowsService',
      metadata: {
        workflowId,
        workflowName: workflow.name,
        triggerCount: triggers.length,
        allowedRoles: workflow.allowedRoles,
        allowedUsers: workflow.allowedUsers
      }
    });

    // Delete existing triggers
    await workflowTriggerRepository.delete({ workflowId });

    return savedWorkflow;
  }

  async loadWorkflow(workflowId: string): Promise<Workflow> {
    const workflowRepository = await this.getRepository(Workflow);
    const workflow = await workflowRepository.findOne({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    return workflow;
  }

  async getWorkflowNodes(workflowId: string): Promise<(NodeData & { id: string })[]> {
    const workflowRepository = await this.getRepository(Workflow);
    const workflow = await workflowRepository.findOne({
      where: { id: workflowId }
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const { nodes } = yamlToWorkflow(workflow.yaml);
    return nodes.map(node => ({ ...node.data, id: node.id }));
  }

  async setWorkflowStatus(workflowId: string, status: 'draft' | 'active' | 'archived'): Promise<Workflow> {
    const workflowRepository = await this.getRepository(Workflow);
    const workflowTriggerRepository = await this.getRepository(WorkflowTrigger);
    const workflow = await workflowRepository.findOne({
      where: { id: workflowId }
    });

    if (!workflow) {
      await this.logs.warning('Workflow status update attempted on non-existent workflow', {
        category: 'workflow',
        source: 'WorkflowsService',
        metadata: { workflowId }
      });
      throw new Error('Workflow not found');
    }

    // Update workflow status
    workflow.status = status;

    // If workflow is archived, deactivate all triggers
    if (status === 'archived') {
      await workflowTriggerRepository.update(
        { workflowId },
        { status: 'inactive' }
      );

      await this.logs.info('Workflow archived and triggers deactivated', {
        category: 'workflow',
        source: 'WorkflowsService',
        metadata: {
          workflowId,
          workflowName: workflow.name
        }
      });
    } else {
      await this.logs.info('Workflow status updated', {
        category: 'workflow',
        source: 'WorkflowsService',
        metadata: {
          workflowId,
          workflowName: workflow.name,
          newStatus: status
        }
      });
    }

    return await workflowRepository.save(workflow);
  }

  async listWorkflows(): Promise<Workflow[]> {
    const workflowRepository = await this.getRepository(Workflow);
    return await workflowRepository.find({
    });
  }

  async getWorkflowTriggers(workflowId: string): Promise<WorkflowTrigger[]> {
    const workflowTriggerRepository = await this.getRepository(WorkflowTrigger);
    return await workflowTriggerRepository.find({
      where: { workflowId },
      relations: ['workflow']
    });
  }

  async setTriggerStatus(triggerId: string, status: 'active' | 'inactive'): Promise<WorkflowTrigger> {
    const workflowTriggerRepository = await this.getRepository(WorkflowTrigger);
    const trigger = await workflowTriggerRepository.findOne({
      where: { id: triggerId }
    });

    if (!trigger) {
      throw new Error('Trigger not found');
    }

    trigger.status = status;
    return await workflowTriggerRepository.save(trigger);
  }

  async saveTrigger(data: SaveTriggerInput): Promise<WorkflowTrigger> {
    const workflowTriggerRepository = await this.getRepository(WorkflowTrigger);
    const trigger = new WorkflowTrigger();
    trigger.id = uuid();
    trigger.workflowId = data.workflowId;
    trigger.name = data.name;
    trigger.type = data.type;
    trigger.eventName = data.eventName;
    trigger.config = JSON.stringify(data.config);
    trigger.status = 'active';
    trigger.createdBy = data.createdBy;

    return await workflowTriggerRepository.save(trigger);
  }

  async updateTrigger(triggerId: string, data: UpdateTriggerInput): Promise<WorkflowTrigger> {
    const workflowTriggerRepository = await this.getRepository(WorkflowTrigger);
    const trigger = await workflowTriggerRepository.findOne({
      where: { id: triggerId }
    });

    if (!trigger) {
      throw new Error('Trigger not found');
    }

    trigger.name = data.name;
    trigger.type = data.type;
    trigger.eventName = data.eventName;
    trigger.config = JSON.stringify(data.config);
    trigger.status = data.status;

    return await workflowTriggerRepository.save(trigger);
  }

  async deleteTrigger(triggerId: string): Promise<void> {
    const workflowTriggerRepository = await this.getRepository(WorkflowTrigger);
    await workflowTriggerRepository.delete({ id: triggerId });
  }
}

interface SaveWorkflowInput {
  yaml: string;
  createdBy: string;
}

interface UpdateWorkflowInput {
  yaml: string;
}

interface SaveTriggerInput {
  workflowId: string;
  name: string;
  type: string;
  eventName: string;
  config: Record<string, unknown>;
  createdBy: string;
}

interface UpdateTriggerInput {
  name: string;
  type: string;
  eventName: string;
  config: Record<string, unknown>;
  status: 'active' | 'inactive';
}