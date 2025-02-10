import { Autowire, Injectable } from 'ts-injection';
import { workflows } from '@/lib/models/platform.sql';
import { eq, sql } from 'drizzle-orm';
import { PLATFORM_DB_TOKEN } from '../injector/tokens';
import { type PlatformDB } from './tenants.service';
import { yamlToWorkflow, validateWorkflowYaml } from '@/components/workflow/yaml/converter';

@Injectable()
export class WorkflowsService {
  @Autowire(PLATFORM_DB_TOKEN)
  private readonly db: PlatformDB;

  async setStatus(workflowId: string, status: 'draft' | 'active' | 'archived') {
    return await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowId));

      if (!current) {
        throw new Error('Workflow not found');
      }

      await tx
        .update(workflows)
        .set({ 
          yaml: sql`${current.yaml}`,
          name: sql`${current.name}`,
          description: current.description ? sql`${current.description}` : null,
          status: sql`${status}`,
          version: current.version,
          allowedRoles: sql`${current.allowedRoles}`,
          allowedUsers: sql`${current.allowedUsers}`,
          updatedAt: new Date().getTime()
        })
        .where(eq(workflows.id, workflowId));

      return this.loadWorkflow(workflowId);
    });
  }

  async saveWorkflow({
    yaml,
    createdBy,
  }: {
    yaml: string,
    createdBy: string,
  }) {
    // Validate YAML format and schema
    if (!validateWorkflowYaml(yaml)) {
      throw new Error('Invalid workflow YAML');
    }

    // Parse YAML to extract metadata
    const { workflow } = yamlToWorkflow(yaml);

    // Insert the workflow with YAML and metadata
    const [saved] = await this.db
      .insert(workflows)
      .values({
        yaml: sql`${yaml}`,
        name: sql`${workflow.name}`,
        description: workflow.description ? sql`${workflow.description}` : null,
        status: sql`draft`,
        version: 1,
        allowedRoles: sql`${JSON.stringify(workflow.allowedRoles)}`,
        allowedUsers: sql`${JSON.stringify(workflow.allowedUsers)}`,
        createdBy: sql`${createdBy}`,
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime()
      })
      .returning();

    // Return the parsed workflow with the new ID
    return yamlToWorkflow(saved.yaml, { id: saved.id });
  }

  async loadWorkflow(workflowId: string) {
    // Get workflow
    const [workflow] = await this.db.select()
      .from(workflows)
      .where(eq(workflows.id, workflowId))
      .execute();

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Parse YAML and return workflow data
    return workflow;
  }

  async updateWorkflow(workflowId: string, yaml: string) {
    return await this.db.transaction(async (tx) => {
      // Get current workflow
      const [currentWorkflow] = await tx
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowId));

      if (!currentWorkflow) {
        throw new Error('Workflow not found');
      }

      // Validate new YAML
      if (!validateWorkflowYaml(yaml)) {
        throw new Error('Invalid workflow YAML');
      }

      // Parse YAML to extract metadata
      const { workflow } = yamlToWorkflow(yaml);

      // Always increment version
      const newVersion = currentWorkflow.version + 1;

      // Update workflow with new YAML and version
      await tx
        .update(workflows)
        .set({
          yaml: sql`${yaml}`,
          version: newVersion,
          name: sql`${workflow.name}`,
          description: workflow.description ? sql`${workflow.description}` : null,
          allowedRoles: sql`${JSON.stringify(workflow.allowedRoles)}`,
          allowedUsers: sql`${JSON.stringify(workflow.allowedUsers)}`,
          updatedAt: new Date().getTime()
        })
        .where(eq(workflows.id, workflowId));

      // Return the updated workflow
      const [updated] = await tx
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowId))
        .execute();

      return {
        ...updated,
        parsed: yamlToWorkflow(updated.yaml, { id: workflowId })
      };
    });
  }
}