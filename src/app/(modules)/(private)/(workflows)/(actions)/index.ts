'use server';

import { env } from "@/lib/constants";
import { inject } from "@/lib/injector/utils";
import * as clients from "@restatedev/restate-sdk-clients";
import { workflowService } from "../(server)/workflow-service";
import assert from "assert";
import { WorkflowsService } from "@/lib/services/workflows.service";

export const list = inject(
  [WorkflowsService],
  async ({ }, [workflowsService]) => {
    const workflows = await workflowsService.listWorkflows();
    return workflows.map((workflow) => ({
      ...workflow,
    }));
  }
);

export const load = inject(
  [WorkflowsService],
  async ({ }, [workflowsService], workflowId: string) => {
    const workflow = await workflowsService.loadWorkflow(workflowId);
    return {
      id: workflow.id,
      yaml: workflow.yaml
    };
  }
);

export const save = inject(
  [WorkflowsService],
  async ({ user }, [workflowsService], { workflowId, yaml }: { workflowId?: string, yaml: string }) => {
    if (!user?.email) {
      throw new Error('User email is required');
    }

    if (workflowId) {
      const workflow = await workflowsService.updateWorkflow(workflowId, {
        yaml,
      });
      return {
        id: workflow.id,
        yaml: workflow.yaml
      };
    } else {
      const workflow = await workflowsService.saveWorkflow({
        yaml,
        createdBy: user.email,
      });
      return {
        id: workflow.id,
        yaml: workflow.yaml
      };
    }
  }
);

export const setStatus = inject(
  [WorkflowsService],
  async ({ }, [workflowsService], { workflowId, status }: { workflowId: string, status: 'draft' | 'active' | 'archived' }) => {
    const workflow = await workflowsService.setWorkflowStatus(workflowId, status);
    return {
      id: workflow.id,
      status: workflow.status
    };
  }
);

export const run = inject(
  [],
  async ({ user }, [], { workflowId, inputs }: { workflowId: string, inputs: Record<string, unknown> }) => {
    assert(user, 'User not found');
    
    const rs = clients.connect({ url: env.RESTATE_ENDPOINT });

    const count = await rs
      .objectSendClient(workflowService, "start")
      .start({ workflowId, variables: inputs });

    console.log('Running workflow', workflowId, 'with inputs', inputs, 'and count', count);
    return { success: true };
  }
);