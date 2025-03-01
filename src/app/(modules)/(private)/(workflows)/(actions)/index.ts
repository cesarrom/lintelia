'use server';

import { env } from "@/lib/constants";
import { inject } from "@/lib/injector/utils";
import { WorkflowsService, LogsService } from "@/lib/services";
import { v4 as uuid } from 'uuid';

export const list = inject(
  [WorkflowsService, LogsService],
  async ({ }, [workflowsService, logs]) => {
    await logs.debug('Listing workflows', {
      category: 'workflow',
      source: 'WorkflowActions'
    });

    const workflows = await workflowsService.listWorkflows();
    return workflows.map((workflow) => ({
      ...workflow,
    }));
  }
);

export const load = inject(
  [WorkflowsService, LogsService],
  async ({ }, [workflowsService, logs], workflowId: string) => {
    await logs.debug('Loading workflow', {
      category: 'workflow',
      source: 'WorkflowActions',
      metadata: { workflowId }
    });

    const workflow = await workflowsService.loadWorkflow(workflowId);
    return {
      id: workflow.id,
      yaml: workflow.yaml
    };
  }
);

export const save = inject(
  [WorkflowsService, LogsService],
  async ({ user }, [workflowsService, logs], { workflowId, yaml }: { workflowId?: string, yaml: string }) => {
    if (!user?.email) {
      await logs.error('User email is required for saving workflow', {
        category: 'workflow',
        source: 'WorkflowActions'
      });
      throw new Error('User email is required');
    }

    try {
      if (workflowId) {
        await logs.info('Updating workflow', {
          category: 'workflow',
          source: 'WorkflowActions',
          userId: user.email,
          metadata: { workflowId }
        });

        const workflow = await workflowsService.updateWorkflow(workflowId, {
          yaml,
        });
        return {
          id: workflow.id,
          yaml: workflow.yaml
        };
      } else {
        await logs.info('Creating new workflow', {
          category: 'workflow',
          source: 'WorkflowActions',
          userId: user.email
        });

        const workflow = await workflowsService.saveWorkflow({
          yaml,
          createdBy: user.email,
        });
        return {
          id: workflow.id,
          yaml: workflow.yaml
        };
      }
    } catch (error) {
      await logs.error('Failed to save workflow', {
        category: 'workflow',
        source: 'WorkflowActions',
        userId: user.email,
        metadata: {
          workflowId,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }
);

export const setStatus = inject(
  [WorkflowsService, LogsService],
  async ({ }, [workflowsService, logs], { workflowId, status }: { workflowId: string, status: 'draft' | 'active' | 'archived' }) => {
    await logs.info('Setting workflow status', {
      category: 'workflow',
      source: 'WorkflowActions',
      metadata: {
        workflowId,
        status
      }
    });

    const workflow = await workflowsService.setWorkflowStatus(workflowId, status);
    return {
      id: workflow.id,
      status: workflow.status
    };
  }
);

export const run = inject(
  [LogsService],
  async ({ user }, [logs], { variables, yaml, token, domain }: { variables: Record<string, unknown>, yaml: string, token: string, domain: string }) => {
    const executionId = uuid();
    
    try {
      await logs.info('Starting workflow execution', {
        category: 'workflow',
        source: 'WorkflowActions',
        userId: user?.email,
        metadata: {
          executionId,
          domain,
          variables: Object.keys(variables),
          yamlLength: yaml.length
        }
      });

      const response = await fetch(`${env.RESTATE_ENDPOINT}/workflow/${executionId}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variables,
          yaml,
          token,
          domain,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        await logs.error('Failed to run workflow', {
          category: 'workflow',
          source: 'WorkflowActions',
          userId: user?.email,
          metadata: {
            executionId,
            domain,
            statusCode: response.status,
            error: errorText
          }
        });
        throw new Error("Failed to run workflow");
      }

      const result = await response.json();

      await logs.info('Workflow execution started successfully', {
        category: 'workflow',
        source: 'WorkflowActions',
        userId: user?.email,
        metadata: {
          executionId,
          domain,
          result
        }
      });

      return result;
    } catch (error) {
      await logs.error('Workflow execution failed', {
        category: 'workflow',
        source: 'WorkflowActions',
        userId: user?.email,
        metadata: {
          executionId,
          domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }
);