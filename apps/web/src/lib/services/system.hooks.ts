import { useQuery, useMutation, UseQueryOptions, UseMutationOptions, QueryKey } from '@tanstack/react-query';
import type { SystemVariable as SystemVariableSchema, CreateSystemVariableInput } from '@repo/lintelia/schemas';
import { useAxios } from './axios'; // Import useAxios

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL; // Use consistent naming

// --- Argument Type Aliases ---
interface GetSystemVariableArgs {
  key: string; // Use 'key' consistent with backend controller path param
}

// Note: CreateSystemVariableInput includes 'key' and 'value'
// interface UpdateSystemVariableArgs { // Removed as PUT handles upsert
//   key: string;
//   data: UpdateSystemVariableInput; // Backend uses CreateSystemVariableInput for PUT
// }

interface DeleteSystemVariableArgs {
  key: string; // Use 'key'
}

// --- Response Type Aliases ---
// For getSystemVariableNames, the value is omitted
type SystemVariableOmittedValue = Omit<SystemVariableSchema, 'value'>;

// --- Hooks ---

// getSystemVariables - GET /system-variables
export const useSystemGetSystemVariables = (
  options?: Omit<UseQueryOptions<SystemVariableSchema[], Error, SystemVariableSchema[], QueryKey>, 'queryKey' | 'queryFn'>
) => {
  const { axios, ready } = useAxios();
  return useQuery<SystemVariableSchema[], Error, SystemVariableSchema[], QueryKey>({
    queryKey: ['system-variables', 'list'], // Use path as part of key
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/system-variables`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: ready && options?.enabled !== false, // Ensure ready
    ...options,
  });
};

// getSystemVariableNames - GET /system-variables/names
export const useSystemGetSystemVariableNames = (
  options?: Omit<UseQueryOptions<SystemVariableOmittedValue[], Error, SystemVariableOmittedValue[], QueryKey>, 'queryKey' | 'queryFn'>
) => {
  const { axios, ready } = useAxios();
  return useQuery<SystemVariableOmittedValue[], Error, SystemVariableOmittedValue[], QueryKey>({
    queryKey: ['system-variables', 'names'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/system-variables/names`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: ready && options?.enabled !== false, // Ensure ready
    ...options,
  });
};

// getSystemVariable - GET /system-variables/:key
export const useSystemGetSystemVariable = (
  args: GetSystemVariableArgs,
  options?: Omit<UseQueryOptions<SystemVariableSchema | null, Error, SystemVariableSchema | null, QueryKey>, 'queryKey' | 'queryFn'>
) => {
  const { key } = args;
  const { axios, ready } = useAxios();
  return useQuery<SystemVariableSchema | null, Error, SystemVariableSchema | null, QueryKey>({
    queryKey: ['system-variables', 'get', key],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/system-variables/${key}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      // Handle potential 404 or empty response for null
      return response.status === 404 ? null : response.data;
    },
    enabled: ready && !!key && options?.enabled !== false, // Ensure ready and key
    ...options,
  });
};

// setSystemVariable - PUT /system-variables/:key (Handles Create/Update)
export const useSystemSetSystemVariable = (
  options?: UseMutationOptions<SystemVariableSchema, Error, CreateSystemVariableInput>
) => {
  const { axios } = useAxios();
  return useMutation<SystemVariableSchema, Error, CreateSystemVariableInput>({
    mutationFn: async (data: CreateSystemVariableInput) => {
      const { name: key, ...bodyData } = data; // Extract key for path, send rest in body
      // Backend controller expects 'data' which is CreateSystemVariableInput
      // But route is PUT /:key. Let's send the value in the body.
      // If the backend truly expects the whole CreateSystemVariableInput in the body,
      // including the key again, this might need adjustment.
      // Assuming PUT body only needs the value part based on REST principles.
      const response = await axios.put(`${API_BASE_URL}/system-variables/${key}`, { value: bodyData.value }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    ...options,
  });
};

// deleteSystemVariable - DELETE /system-variables/:key
export const useSystemDeleteSystemVariable = (
  options?: UseMutationOptions<boolean, Error, DeleteSystemVariableArgs>
) => {
  const { axios } = useAxios();
  return useMutation<boolean, Error, DeleteSystemVariableArgs>({
    mutationFn: async (args: DeleteSystemVariableArgs) => {
      const { key } = args;
      const response = await axios.delete(`${API_BASE_URL}/system-variables/${key}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      // Assuming backend returns true/false
      return response.data;
    },
    ...options,
  });
};
