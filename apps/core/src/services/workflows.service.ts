import { UnprocessableError } from '../http/errors';
import { sysWorkflows } from '../entities/tenants';
import { sysWorkflowTriggers } from '../entities/tenants';
import { LogsService } from './logs.service';
import { v4 as uuid } from 'uuid';
import yaml from 'yaml';
import { AbstractService } from './service';
import { eq } from 'drizzle-orm';
import { NodeData, SaveTriggerInput, SaveWorkflowInput, UpdateTriggerInput, UpdateWorkflowInput, Workflow, WorkflowTrigger } from '@repo/lintelia/schemas';
import { validateWorkflowYaml, yamlToWorkflow } from '@repo/lintelia/utilities';
import { TENANT_CONNECTION } from '../injector/tokens/tenant-connection.token';
import { type TenantDatabase } from '../clients/database.client';
import { Injectable, Inject, Scope } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class WorkflowsService extends AbstractService {
  constructor(
    @Inject(TENANT_CONNECTION) private db: TenantDatabase,
    @Inject(LogsService) private logs: LogsService
  ) { super(); }

  async saveWorkflow(data: SaveWorkflowInput): Promise<Workflow> {
    // Validate YAML format and schema
    if (!validateWorkflowYaml(data.yaml)) {
      await this.logs.error('Invalid workflow YAML', {
        category: 'workflow',
        source: 'WorkflowsService',
        userId: data.createdBy,
        metadata: { yaml: data.yaml }
      });
      throw new UnprocessableError('Invalid workflow YAML');
    }

    // Parse YAML to extract metadata
    const { workflow: parsedWorkflow, triggers } = yamlToWorkflow(data.yaml);


    // Create workflow
    const workflow = {
      id: parsedWorkflow.id || uuid(),
      name: parsedWorkflow.name,
      description: parsedWorkflow.description,
      yaml: data.yaml,
      allowedRoles: parsedWorkflow.allowedRoles || [],
      allowedUsers: parsedWorkflow.allowedUsers || [],
      createdBy: data.createdBy
    } as Workflow;

    const parsedYaml = yaml.parse(data.yaml);

    parsedYaml.id = workflow.id;
    workflow.yaml = yaml.stringify(parsedYaml);
    workflow.allowedRoles = parsedWorkflow.allowedRoles || [];
    workflow.allowedUsers = parsedWorkflow.allowedUsers || [];
    workflow.createdBy = data.createdBy;

    // Save workflow first
    const [savedWorkflow] = await this.db.insert(sysWorkflows).values(workflow).returning().execute();

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
    const [workflow] = await this.db.select().from(sysWorkflows).where(eq(sysWorkflows.id, workflowId)).execute();

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
      throw new UnprocessableError('Invalid workflow YAML');
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
    const [savedWorkflow] = await this.db.update(sysWorkflows).set(workflow).where(eq(sysWorkflows.id, workflowId)).returning().execute();

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
    await this.db.delete(sysWorkflowTriggers).where(eq(sysWorkflowTriggers.workflowId, workflowId)).execute();

    return savedWorkflow;
  }

  async loadWorkflow(workflowId: string): Promise<Workflow> {
    const [workflow] = await this.db.select().from(sysWorkflows).where(eq(sysWorkflows.id, workflowId)).execute();

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    return workflow;
  }

  async getWorkflowNodes(workflowId: string): Promise<(NodeData & { id: string })[]> {
    const [workflow] = await this.db.select().from(sysWorkflows).where(eq(sysWorkflows.id, workflowId)).execute();

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const { nodes } = yamlToWorkflow(workflow.yaml);
    return nodes.map(node => ({ ...node.data, id: node.id }));
  }

  async setWorkflowStatus(workflowId: string, status: 'draft' | 'active' | 'archived'): Promise<Workflow> {
    const [workflow] = await this.db.select().from(sysWorkflows).where(eq(sysWorkflows.id, workflowId)).execute();

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
      await this.db.update(sysWorkflowTriggers).set({ status: 'inactive' }).where(eq(sysWorkflowTriggers.workflowId, workflowId)).execute();

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

    const [savedWorkflow] = await this.db.update(sysWorkflows).set(workflow).where(eq(sysWorkflows.id, workflowId)).returning().execute();

    return savedWorkflow;
  }

  async listWorkflows(): Promise<Workflow[]> {
    return await this.db.select().from(sysWorkflows).execute();
  }

  async getWorkflowTriggers(workflowId: string): Promise<WorkflowTrigger[]> {
    return await this.db.select().from(sysWorkflowTriggers).where(eq(sysWorkflowTriggers.workflowId, workflowId)).execute();
  }

  async setTriggerStatus(triggerId: string, status: 'active' | 'inactive'): Promise<WorkflowTrigger> {
    const [trigger] = await this.db.select().from(sysWorkflowTriggers).where(eq(sysWorkflowTriggers.id, triggerId)).execute();

    if (!trigger) {
      throw new Error('Trigger not found');
    }

    trigger.status = status;
    const [savedTrigger] = await this.db.update(sysWorkflowTriggers).set(trigger).where(eq(sysWorkflowTriggers.id, triggerId)).returning().execute();

    return savedTrigger;
  }

  async saveTrigger(data: SaveTriggerInput): Promise<WorkflowTrigger> {
    const trigger = {
      id: uuid(),
      workflowId: data.workflowId,
      name: data.name,
      type: data.type,
      eventName: data.eventName,
      config: JSON.stringify(data.config),
      status: 'active',
      createdBy: data.createdBy
    } as WorkflowTrigger;

    const [result] = await this.db.insert(sysWorkflowTriggers).values(trigger).returning().execute();

    return result;
  }

  async updateTrigger(triggerId: string, data: UpdateTriggerInput): Promise<WorkflowTrigger> {
    const [trigger] = await this.db.select().from(sysWorkflowTriggers).where(eq(sysWorkflowTriggers.id, triggerId)).execute();

    if (!trigger) {
      throw new Error('Trigger not found');
    }

    trigger.name = data.name;
    trigger.type = data.type;
    trigger.eventName = data.eventName;
    trigger.config = JSON.stringify(data.config);
    trigger.status = data.status;

    const [savedTrigger] = await this.db.update(sysWorkflowTriggers).set(trigger).where(eq(sysWorkflowTriggers.id, triggerId)).returning().execute();
    return savedTrigger;
  }

  async deleteTrigger(triggerId: string): Promise<void> {
    await this.db.delete(sysWorkflowTriggers).where(eq(sysWorkflowTriggers.id, triggerId)).execute();
  }
}
