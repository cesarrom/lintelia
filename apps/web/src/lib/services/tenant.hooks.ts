import { useQuery, useMutation, UseQueryOptions, UseMutationOptions, QueryKey } from '@tanstack/react-query';
import type { Tenant as TenantSchema, CreateTenant, DeleteTenantRequest, GetTenantRequest, CreateTenantResponse, UpdateTenantRequest } from '@repo/lintelia/schemas';
import { useAxios } from './axios'; // Import useAxios

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL; // Use consistent naming

// --- Hooks ---

// createTenant - POST /tenants
export const useTenantCreateTenant = (
  options?: UseMutationOptions<CreateTenantResponse, Error, CreateTenant>
) => {
  const { axios } = useAxios();
  return useMutation<CreateTenantResponse, Error, CreateTenant>({
    mutationFn: async (tenantData: CreateTenant): Promise<CreateTenantResponse> => {
      const response = await axios.post(`${API_BASE_URL}/tenants`, tenantData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    ...options,
  });
};

// deleteTenant - DELETE /tenants (Note: Sends data in body as per controller)
export const useTenantDeleteTenant = (
  options?: UseMutationOptions<void, Error, DeleteTenantRequest> // Keeping void return for now
) => {
  const { axios } = useAxios();
  return useMutation<void, Error, DeleteTenantRequest>({
    mutationFn: async (args: DeleteTenantRequest): Promise<void> => {
      // Although DELETE typically doesn't have a body, the controller expects it.
      await axios.delete(`${API_BASE_URL}/tenants`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: args, // Pass args in the data field for axios delete with body
      });
      // No specific return value needed if successful
    },
    ...options,
  });
};

// getTenant - GET /tenants?domain={domain}
export const useTenantGetTenant = (
  args: GetTenantRequest, // Contains optional domain
  options?: Omit<UseQueryOptions<TenantSchema | null, Error, TenantSchema | null, QueryKey>, 'queryKey' | 'queryFn'>
) => {
  const { domain } = args;
  const { axios, ready } = useAxios();
  return useQuery<TenantSchema | null, Error, TenantSchema | null, QueryKey>({
    queryKey: ['tenants', 'get', domain], // Include domain in key if present
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/tenants`, {
        params: { domain }, // Pass domain as query parameter
        headers: {
          'Content-Type': 'application/json',
        },
      });
      // Handle potential 404 or empty response for null
      return response.status === 404 ? null : response.data;
    },
    enabled: ready && options?.enabled !== false, // Ensure ready
    ...options,
  });
};

// updateTenant - PUT /tenants
export const useTenantUpdateTenant = (
  options?: UseMutationOptions<TenantSchema, Error, UpdateTenantRequest>
) => {
  const { axios } = useAxios();
  return useMutation<TenantSchema, Error, UpdateTenantRequest>({
    mutationFn: async (args: UpdateTenantRequest): Promise<TenantSchema> => {
      const response = await axios.put(`${API_BASE_URL}/tenants`, args, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    ...options,
  });
};
