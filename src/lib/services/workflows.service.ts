import { inject, injectable } from 'tsyringe';
import { TENANT_DB_TOKEN } from '../injector/tokens';
import { DataSource, Repository } from 'typeorm';
import { Workflow } from '../entities/tenant/workflow.entity';
import { WorkflowTrigger } from '../entities/tenant/workflow-trigger.entity';
import { LogsService } from './logs.service';
import { v4 as uuid } from 'uuid';
import { validateWorkflowYaml, yamlToWorkflow } from '@/app/(modules)/(private)/(workflows)/(components)/yaml/converter';
import { type NodeData } from '@/app/(modules)/(private)/(workflows)/(components)/yaml/types';

@injectable()
export class WorkflowsService {
  private workflowRepository: Repository<Workflow>;
  private workflowTriggerRepository: Repository<WorkflowTrigger>;

  constructor(
    @inject(TENANT_DB_TOKEN) private conn: DataSource,
    @inject(LogsService) private logs: LogsService
  ) {
    this.workflowRepository = this.conn.getRepository(Workflow);
    this.workflowTriggerRepository = this.conn.getRepository(WorkflowTrigger);
  }

  async saveWorkflow(data: SaveWorkflowInput): Promise<Workflow> {
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
    workflow.id = uuid();
    workflow.name = parsedWorkflow.name;
    workflow.description = parsedWorkflow.description;
    workflow.yaml = data.yaml;
    workflow.allowedRoles = parsedWorkflow.allowedRoles || [];
    workflow.allowedUsers = parsedWorkflow.allowedUsers || [];
    workflow.createdBy = data.createdBy;

    // Save workflow first
    const savedWorkflow = await this.workflowRepository.save(workflow);

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

    // Create triggers
    for (const trigger of triggers) {
      try {
        await this.saveTrigger({
          workflowId: savedWorkflow.id,
          name: trigger.name,
          type: trigger.type,
          eventName: trigger.eventName,
          config: trigger.config,
          createdBy: data.createdBy
        });
      } catch (error) {
        await this.logs.error('Failed to create workflow trigger', {
          category: 'workflow',
          source: 'WorkflowsService',
          userId: data.createdBy,
          metadata: {
            workflowId: savedWorkflow.id,
            triggerName: trigger.name,
            error: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }

    return savedWorkflow;
  }

  async updateWorkflow(workflowId: string, data: UpdateWorkflowInput): Promise<Workflow> {
    const workflow = await this.workflowRepository.findOne({
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
    workflow.yaml = data.yaml;
    workflow.allowedRoles = parsedWorkflow.allowedRoles || [];
    workflow.allowedUsers = parsedWorkflow.allowedUsers || [];

    // Save workflow
    const savedWorkflow = await this.workflowRepository.save(workflow);

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
    await this.workflowTriggerRepository.delete({ workflowId });

    // Create new triggers
    for (const trigger of triggers) {
      try {
        const workflowTrigger = new WorkflowTrigger();
        workflowTrigger.id = uuid();
        workflowTrigger.workflowId = savedWorkflow.id;
        workflowTrigger.name = trigger.name as string;
        workflowTrigger.type = trigger.type as string;
        workflowTrigger.eventName = (trigger.config.eventName as string) || trigger.name as string;
        workflowTrigger.config = JSON.stringify(trigger.config);
        workflowTrigger.status = 'active';
        workflowTrigger.createdBy = workflow.createdBy;

        await this.workflowTriggerRepository.save(workflowTrigger);

        await this.logs.info('Workflow trigger updated', {
          category: 'workflow',
          source: 'WorkflowsService',
          metadata: {
            workflowId,
            triggerId: workflowTrigger.id,
            triggerName: workflowTrigger.name,
            eventName: workflowTrigger.eventName
          }
        });
      } catch (error) {
        await this.logs.error('Failed to update workflow trigger', {
          category: 'workflow',
          source: 'WorkflowsService',
          metadata: {
            workflowId,
            triggerName: trigger.name,
            error: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }

    return savedWorkflow;
  }

  async loadWorkflow(workflowId: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findOne({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    return workflow;
  }

  async getWorkflowNodes(workflowId: string): Promise<(NodeData & { id: string })[]> {
    const workflow = await this.workflowRepository.findOne({
      where: { id: workflowId }
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const { nodes } = yamlToWorkflow(workflow.yaml);
    return nodes.map(node => ({ ...node.data, id: node.id }));
  }

  async setWorkflowStatus(workflowId: string, status: 'draft' | 'active' | 'archived'): Promise<Workflow> {
    const workflow = await this.workflowRepository.findOne({
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
      await this.workflowTriggerRepository.update(
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

    return await this.workflowRepository.save(workflow);
  }

  async listWorkflows(): Promise<Workflow[]> {
    return await this.workflowRepository.find({
    });
  }

  async getWorkflowTriggers(workflowId: string): Promise<WorkflowTrigger[]> {
    return await this.workflowTriggerRepository.find({
      where: { workflowId },
      relations: ['workflow']
    });
  }

  async setTriggerStatus(triggerId: string, status: 'active' | 'inactive'): Promise<WorkflowTrigger> {
    const trigger = await this.workflowTriggerRepository.findOne({
      where: { id: triggerId }
    });

    if (!trigger) {
      throw new Error('Trigger not found');
    }

    trigger.status = status;
    return await this.workflowTriggerRepository.save(trigger);
  }

  async saveTrigger(data: SaveTriggerInput): Promise<WorkflowTrigger> {
    const trigger = new WorkflowTrigger();
    trigger.id = uuid();
    trigger.workflowId = data.workflowId;
    trigger.name = data.name;
    trigger.type = data.type;
    trigger.eventName = data.eventName;
    trigger.config = JSON.stringify(data.config);
    trigger.status = 'active';
    trigger.createdBy = data.createdBy;

    return await this.workflowTriggerRepository.save(trigger);
  }

  async updateTrigger(triggerId: string, data: UpdateTriggerInput): Promise<WorkflowTrigger> {
    const trigger = await this.workflowTriggerRepository.findOne({
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

    return await this.workflowTriggerRepository.save(trigger);
  }

  async deleteTrigger(triggerId: string): Promise<void> {
    await this.workflowTriggerRepository.delete({ id: triggerId });
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