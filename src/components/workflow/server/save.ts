'use server';

import { getContextualInjector } from "@/actions/injector";
import { getUser } from "@/actions/users";
import { WorkflowsService } from "@/lib/services";
import { Edge, type Node } from "reactflow";
import { type NodeData } from "../nodes/types";

interface SaveWorkflowParams {
  workflowId?: string;
  yaml: string;
}

interface SaveWorkflowResponse {
  workflowId: string;
  yaml: string;
}

export async function save(params: SaveWorkflowParams): Promise<SaveWorkflowResponse> {
  const response = await fetch('/api/workflows', {
    method: params.workflowId ? 'PUT' : 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error('Failed to save workflow');
  }

  return response.json();
}