import { useQuery, useMutation, UseQueryOptions, UseMutationOptions, QueryKey } from '@tanstack/react-query';
import type { UserResponse as UserSchema, InviteUserInput, UpdateUserRolesRequest } from '@repo/lintelia/schemas';
import { useAxios } from './axios'; // Import useAxios

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL; // Use consistent naming

// --- Type Aliases for Arguments ---
interface GetUserArgs {
  id: string;
}

// Argument for simple PATCH actions needing only userId in path
interface UserIdArgs {
  userId: string;
}

// --- Hooks ---

// getUsers - GET /users
export const useUsersGetUsers = (
  options?: Omit<UseQueryOptions<UserSchema[], Error, UserSchema[], QueryKey>, 'queryKey' | 'queryFn'>
) => {
  const { axios, ready } = useAxios();
  return useQuery<UserSchema[], Error, UserSchema[], QueryKey>({
    queryKey: ['users', 'list'] as const,
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/users`, {
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

// getUser - GET /users/:userId
export const useUsersGetUser = (
  args: GetUserArgs,
  options?: Omit<UseQueryOptions<UserSchema | null, Error, UserSchema | null, QueryKey>, 'queryKey' | 'queryFn'>
) => {
  const { id } = args;
  const { axios, ready } = useAxios();
  return useQuery<UserSchema | null, Error, UserSchema | null, QueryKey>({
    queryKey: ['users', 'get', id] as const,
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/users/${id}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      // Handle potential 404 or empty response for null
      return response.status === 404 ? null : response.data;
    },
    enabled: ready && !!id && options?.enabled !== false, // Ensure ready and id
    ...options,
  });
};

// inviteUser - POST /users
export const useUsersInviteUser = (
  options?: UseMutationOptions<boolean, Error, InviteUserInput>
) => {
  const { axios } = useAxios();
  return useMutation<boolean, Error, InviteUserInput>({
    mutationFn: async (data: InviteUserInput) => {
      const response = await axios.post(`${API_BASE_URL}/users`, data, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data; // Assuming backend returns boolean
    },
    ...options,
  });
};

// updateUserRoles - PUT /users/:userId
export const useUsersUpdateUserRoles = (
  options?: UseMutationOptions<boolean, Error, UpdateUserRolesRequest>
) => {
  const { axios } = useAxios();
  return useMutation<boolean, Error, UpdateUserRolesRequest>({
    mutationFn: async (data: UpdateUserRolesRequest) => {
      // Controller expects userId and roleIds in body for PUT /:userId
      const response = await axios.put(`${API_BASE_URL}/users/${data.userId}`, data, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data; // Assuming backend returns boolean
    },
    ...options,
  });
};

// deactivateUser - PATCH /users/:userId/deactivate
export const useUsersDeactivateUser = (
  options?: UseMutationOptions<boolean, Error, UserIdArgs> // Use UserIdArgs
) => {
  const { axios } = useAxios();
  return useMutation<boolean, Error, UserIdArgs>({
    mutationFn: async (args: UserIdArgs) => {
      const { userId } = args;
      const response = await axios.patch(`${API_BASE_URL}/users/${userId}/deactivate`, {}, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data; // Assuming backend returns boolean
    },
    ...options,
  });
};

// activateUser - PATCH /users/:userId/activate
export const useUsersActivateUser = (
  options?: UseMutationOptions<boolean, Error, UserIdArgs> // Use UserIdArgs
) => {
  const { axios } = useAxios();
  return useMutation<boolean, Error, UserIdArgs>({
    mutationFn: async (args: UserIdArgs) => {
      const { userId } = args;
      const response = await axios.patch(`${API_BASE_URL}/users/${userId}/activate`, {}, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data; // Assuming backend returns boolean
    },
    ...options,
  });
};

// resetUserPassword - PATCH /users/:userId/reset-password
export const useUsersResetUserPassword = (
  options?: UseMutationOptions<boolean, Error, UserIdArgs> // Use UserIdArgs
) => {
  const { axios } = useAxios();
  return useMutation<boolean, Error, UserIdArgs>({
    mutationFn: async (args: UserIdArgs) => {
      const { userId } = args;
      const response = await axios.patch(`${API_BASE_URL}/users/${userId}/reset-password`, {}, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data; // Assuming backend returns boolean
    },
    ...options,
  });
};
