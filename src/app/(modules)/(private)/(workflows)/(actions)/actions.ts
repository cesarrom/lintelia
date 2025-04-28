'use server';

import { env } from "@/lib/constants";
import { inject } from "@/lib/injector/utils";
import { LogsService } from "@/lib/services/logs.service";
import assert from "assert";
import { v4 as uuid } from 'uuid';
import { yamlToWorkflow } from "../(components)/yaml/converter";
import { SystemTriggersService } from "@/lib/services/system-triggers.service";
import { SystemTrigger } from "@/lib/entities";
import { WorkflowsService } from "@/lib/services/workflows.service";

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

export const create = inject(
  [WorkflowsService, SystemTriggersService, LogsService],
  async ({ user }, [workflowsService, systemTriggersService, logs], { yaml }: { yaml: string }) => {
    assert(user?.email, 'User email is required');

    const { triggers } = yamlToWorkflow(yaml);

    await logs.info('Creating new workflow', {
      category: 'workflow',
      source: 'WorkflowActions',
      userId: user.email
    });

    const wfl = await workflowsService.saveWorkflow({
      yaml,
      createdBy: user.email,
    });

    for (const trigger of triggers) {
      await systemTriggersService.createTrigger(SystemTrigger.fromTriggerDefinition(trigger, {
        createdBy: user.email,
        workflowId: wfl.id,
        active: true
      }));
    }

    return {
      id: wfl.id,
      yaml: wfl.yaml
    };
  }
);

export const update = inject(
  [WorkflowsService, SystemTriggersService, LogsService],
  async ({ user }, [workflowsService, systemTriggersService, logs], { workflowId, yaml }: { workflowId: string, yaml: string }) => {
    assert(user?.email, 'User email is required');

    await logs.info('Updating workflow', {
      category: 'workflow',
      source: 'WorkflowActions',
      userId: user.email,
      metadata: { workflowId }
    });

    const { triggers } = yamlToWorkflow(yaml);

    const existingTriggers = await systemTriggersService.getAllByWorkflowId(workflowId);

    await systemTriggersService.swapTriggersForWorkflow(
      existingTriggers.map(t => t.id),
      triggers.map(t => {
        return SystemTrigger.fromTriggerDefinition(t, {
          createdBy: user?.email || 'system',
          workflowId,
          active: true
        });
      })
    );

    const updatedWorkflow = await workflowsService.updateWorkflow(workflowId, {
      yaml,
    });

    return {
      id: updatedWorkflow.id,
      yaml: updatedWorkflow.yaml
    };
  }
);

export const save = inject(
  [LogsService],
  async ({ user }, [logs], { workflowId, yaml }: { workflowId?: string, yaml: string }) => {
    assert(user?.email, 'User email is required');
    try {
      if (workflowId) {
        return await update({ workflowId, yaml });
      } else {
        return await create({ yaml });
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

export const resume = inject(
  [LogsService],
  async ({ user }, [logs], { resumableId, token, domain }: { resumableId: string, token: string, domain: string }) => {
    const executionId = uuid();

    try {
      await logs.info('Resuming workflow execution', {
        category: 'workflow',
        source: 'WorkflowActions',
        userId: user?.email,
        metadata: {
          executionId,
          domain,
          resumableId
        }
      });

      const response = await fetch(`${env.RESTATE_ENDPOINT}/workflow/${executionId}/resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumableId,
          token,
          domain,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        await logs.error('Failed to resume workflow', {
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
        throw new Error("Failed to resume workflow");
      }

      const result = await response.json();

      await logs.info('Workflow execution resumed successfully', {
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
      await logs.error('Workflow execution resume failed', {
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
