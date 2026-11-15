import { CreateRoleRequest, Role, UpdateRoleRequest } from '@repo/fintivio/schemas';
import { useQuery, useMutation, UseMutationOptions, QueryKey } from '@tanstack/react-query';
import { useAxios } from './axios'; 

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL; 

// --- Hooks ---

// getRolesByUserId - GET /roles/by-users/:userId
export const useRolesGetRolesByUserId = ({ userId, enabled = true }: { userId: string, enabled?: boolean }) => {
  const { axios, ready } = useAxios();
  return useQuery<Role[], Error, Role[], QueryKey>({
    queryKey: ['roles', 'getRolesByUserId', userId],
    queryFn: async (): Promise<Role[]> => { 
      const response = await axios.get(`${API_BASE_URL}/roles/by-users/${userId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: ready && !!userId && enabled, 
  });
};

// getRoles - GET /roles
export const useRolesGetRoles = ({ enabled = true }: { enabled?: boolean }) => {
  const { axios, ready } = useAxios();
  return useQuery<Role[], Error, Role[], QueryKey>({
    queryKey: ['roles', 'getRoles'],
    queryFn: async (): Promise<Role[]> => {
      const response = await axios.get(`${API_BASE_URL}/roles`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: ready && enabled, 
  });
};

// getRole - GET /roles/:roleId
export const useRolesGetRole = ({ id, enabled = true }: { id: string, enabled?: boolean }) => {
  const { axios, ready } = useAxios();
  return useQuery<Role | null, Error, Role | null, QueryKey>({
    queryKey: ['roles', 'getRole', id],
    queryFn: async (): Promise<Role | null> => {
      const response = await axios.get(`${API_BASE_URL}/roles/${id}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.status === 404 ? null : response.data;
    },
    enabled: ready && !!id && enabled, 
  });
};

// createRole - POST /roles
export const useRolesCreateRole = (
  options?: UseMutationOptions<Role, Error, CreateRoleRequest>
) => {
  const { axios } = useAxios();
  return useMutation<Role, Error, CreateRoleRequest>({
    mutationFn: async (args: CreateRoleRequest): Promise<Role> => {
      const response = await axios.post(`${API_BASE_URL}/roles`, args, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    ...options,
  });
};

// updateRole - PUT /roles/:roleId
export const useRolesUpdateRole = (
  options?: UseMutationOptions<Role, Error, UpdateRoleRequest>
) => {
  const { axios } = useAxios();
  return useMutation<Role, Error, UpdateRoleRequest>({
    mutationFn: async (args: UpdateRoleRequest): Promise<Role> => {
      const { id, data } = args; 
      const response = await axios.put(`${API_BASE_URL}/roles/${id}`, data, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    ...options,
  });
};

// deleteRole - DELETE /roles/:roleId
export const useRolesDeleteRole = (
  options?: UseMutationOptions<boolean, Error, string> 
) => {
  const { axios } = useAxios();
  return useMutation<boolean, Error, string>({
    mutationFn: async (id: string): Promise<boolean> => {
      const response = await axios.delete(`${API_BASE_URL}/roles/${id}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    ...options,
  });
};
