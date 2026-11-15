import { useQuery, useMutation, UseQueryOptions, UseMutationOptions, QueryKey } from '@tanstack/react-query';
import type {
  Workflow as WorkflowSchema, // From tenants.schema.ts
  StartWorkflowRequest, // From dto.schema.ts
  ResumeWorkflowRequest, // From dto.schema.ts
  SaveWorkflowRequest, // From dto.schema.ts
  SetWorkflowStatusRequest, // From dto.schema.ts
} from '@repo/fintivio/schemas';
import { useAxios, useRestateClient } from './axios'; // Import useAxios

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL; // Add for standard API calls

// --- Argument Type Aliases ---
interface LoadWorkflowArgs {
  workflowId: string;
}

// interface CreateWorkflowArgs { // Commented out - handled by Save
//   yaml: string;
// }

// interface UpdateWorkflowArgs { // Commented out - handled by Save
//   workflowId: string;
//   yaml: string;
// }

// --- Response Type Aliases ---
type WorkflowExecutionResponse = unknown; // For start/resume

interface WorkflowDetail { // For Load/Save
  id: string;
  yaml: string;
  status?: 'draft' | 'active' | 'archived'; // From WorkflowSchema
}

interface SetWorkflowStatusResponse { // For SetStatus
  id: string;
  status: 'draft' | 'active' | 'archived';
}


// --- Hooks ---

// start (Workflow Execution - Uses Restate Endpoint)
export const useWorkflowStart = (
  options?: UseMutationOptions<WorkflowExecutionResponse, Error, StartWorkflowRequest>
) => {
  const { client, ready } = useRestateClient();
  return useMutation<WorkflowExecutionResponse, Error, StartWorkflowRequest>({
    mutationFn: async (args: StartWorkflowRequest) => {
      if (!ready) {
        throw new Error('Client is not ready');
      }
      const response = await client({
        service: 'workflow',
        method: 'start',
        body: args,
      });

      return response;
    },
    ...options,
  });
};

// resume (Workflow Execution - Uses Restate Endpoint)
export const useWorkflowResume = (
  options?: UseMutationOptions<WorkflowExecutionResponse, Error, ResumeWorkflowRequest>
) => {
  const { client, ready } = useRestateClient();
  return useMutation<WorkflowExecutionResponse, Error, ResumeWorkflowRequest>({
    mutationFn: async (args: ResumeWorkflowRequest) => {
      if (!ready) {
        throw new Error('Client is not ready');
      }
      const response = await client({
        service: 'workflow',
        method: 'resume',
        body: args,
      });

      return response;
    },
    ...options,
  });
};

// list workflows - GET /workflows
export const useWorkflowList = (
  options?: Omit<UseQueryOptions<WorkflowSchema[], Error, WorkflowSchema[], QueryKey>, 'queryKey' | 'queryFn'>
) => {
  const { axios, ready } = useAxios();
  return useQuery<WorkflowSchema[], Error, WorkflowSchema[], QueryKey>({
    queryKey: ['workflows', 'list'] as const,
    queryFn: async () => {
      const response = await axios!.get(`${API_BASE_URL}/workflows`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: ready && options?.enabled !== false,
    ...options,
  });
};

// load workflow - GET /workflows/:workflowId
export const useWorkflowLoad = (
  args: LoadWorkflowArgs,
  options?: Omit<UseQueryOptions<WorkflowDetail | null, Error, WorkflowDetail | null, QueryKey>, 'queryKey' | 'queryFn'>
) => {
  const { workflowId } = args;
  const { axios, ready } = useAxios();
  return useQuery<WorkflowDetail | null, Error, WorkflowDetail | null, QueryKey>({
    queryKey: ['workflows', 'load', workflowId] as const,
    queryFn: async () => {
      const response = await axios!.get(`${API_BASE_URL}/workflows/${workflowId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.status === 404 ? null : response.data;
    },
    enabled: ready && !!workflowId && options?.enabled !== false,
    ...options,
  });
};

// // create workflow - Handled by save
// export const useWorkflowCreate = (
//   options?: UseMutationOptions<WorkflowDetail, Error, CreateWorkflowArgs>
// ) => {
//   return useMutation<WorkflowDetail, Error, CreateWorkflowArgs>({
//     mutationFn: async (args: CreateWorkflowArgs) => {
//       // This logic is now inside the controller's PUT /workflows/:workflowId method
//       // Use useWorkflowSave instead.
//       throw new Error('useWorkflowCreate is deprecated, use useWorkflowSave');
//     },
//     ...options,
//   });
// };

// // update workflow - Handled by save
// export const useWorkflowUpdate = (
//   options?: UseMutationOptions<WorkflowDetail, Error, UpdateWorkflowArgs>
// ) => {
//   return useMutation<WorkflowDetail, Error, UpdateWorkflowArgs>({
//     mutationFn: async (args: UpdateWorkflowArgs) => {
//       // This logic is now inside the controller's PUT /workflows/:workflowId method
//       // Use useWorkflowSave instead.
//       throw new Error('useWorkflowUpdate is deprecated, use useWorkflowSave');
//     },
//     ...options,
//   });
// };

// save workflow (create or update) - PUT /workflows/:workflowId
export const useWorkflowSave = (
  options?: UseMutationOptions<WorkflowDetail, Error, SaveWorkflowRequest>
) => {
  const { axios } = useAxios();
  return useMutation<WorkflowDetail, Error, SaveWorkflowRequest>({
    // The controller handles create vs update based on workflowId presence in body
    // The path parameter :workflowId might be ignored by controller if creating new?
    // Let's assume the controller expects *something* in the path for PUT,
    // even if creating. If creating, maybe send 'new' or rely on controller logic?
    // Safest: For create, maybe the controller should have used POST?
    // For now, pass workflowId if available, otherwise maybe a placeholder?
    // Let's pass workflowId from args for the path. If it's undefined (create), the URL will be /workflows/undefined
    // which might be okay if the controller ignores it when body.workflowId is null/undefined.
    // Or, we could conditionally use POST /workflows for create if it existed.
    // Given only PUT /:workflowId exists, we'll use that.
    mutationFn: async (args: SaveWorkflowRequest) => {
      const { workflowId, ...bodyData } = args;
      // Use workflowId in path if it exists, otherwise rely on controller ignoring it?
      const effectiveId = workflowId || 'create'; // Using 'create' placeholder - ADJUST IF NEEDED based on API
      const response = await axios!.put(`${API_BASE_URL}/workflows/${effectiveId}`, bodyData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    ...options,
  });
};

// setStatus workflow - PATCH /workflows/:workflowId/set-state/:status
export const useWorkflowSetStatus = (
  options?: UseMutationOptions<SetWorkflowStatusResponse, Error, SetWorkflowStatusRequest>
) => {
  const { axios } = useAxios();
  return useMutation<SetWorkflowStatusResponse, Error, SetWorkflowStatusRequest>({
    mutationFn: async (args: SetWorkflowStatusRequest) => {
      const { workflowId, status } = args;
      const response = await axios!.patch(`${API_BASE_URL}/workflows/${workflowId}/set-state/${status}`, {}, { // No body needed
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    ...options,
  });
};
