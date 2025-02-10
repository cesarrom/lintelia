'use server';

import { getContextualInjector } from "@/actions/injector";
import { WorkflowsService } from "@/lib/services";

interface LoadWorkflowParams {
  workflowId: string;
}

interface LoadWorkflowResponse {
  yaml: string;
}

export async function load(params: LoadWorkflowParams): Promise<LoadWorkflowResponse> {
  const response = await fetch(`/api/workflows/${params.workflowId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load workflow');
  }

  return response.json();
}