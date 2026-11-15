import { useQuery, useMutation, UseQueryOptions, UseMutationOptions, QueryKey } from '@tanstack/react-query';
import type {
  AfterLoginRequest,
  AfterLoginResponse,
  // AuthRole, // Not directly used as getUserRoles now returns string[]
} from '@repo/fintivio/schemas';
import { useRestateClient } from './axios';

const AUTH_SERVICE_NAME = 'auth';

// --- Hooks --- //

/**
 * Mutation hook for matching user invitations to roles.
 * This typically runs after login or when user context might have changed.
 */
export const useAuthMatchInvitationsRolesMutation = (
  options?: UseMutationOptions<void, Error, void>
) => {
  const { client, ready } = useRestateClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!ready) {
        throw new Error('Client is not ready');
      }
      const response = await client({
        service: AUTH_SERVICE_NAME,
        method: 'matchInvitationsRoles',
        body: {},
      });
      // No content expected for void response
      return response;
    },
    ...options,
  });
};

/**
 * Query hook to get the roles for the current user.
 */
export const useAuthGetUserRolesQuery = (
  options?: Omit<UseQueryOptions<string[], Error, string[], QueryKey>, 'queryKey' | 'queryFn'>
) => {
  const { client, ready } = useRestateClient();
  return useQuery<string[], Error, string[], QueryKey>({
    queryKey: [AUTH_SERVICE_NAME, 'getUserRoles'] as const,
    queryFn: async (): Promise<string[]> => {
      if (!ready) {
        throw new Error('Client is not ready');
      }
      const response = await client({
        service: AUTH_SERVICE_NAME,
        method: 'getUserRoles',
        body: {},
      });

      return response;
    },
    ...options,
    enabled: options?.enabled && ready,
  });
};

/**
 * Mutation hook for actions to be performed after a user logs in.
 */
export const useAuthAfterLoginMutation = (
  options?: UseMutationOptions<AfterLoginResponse, Error, AfterLoginRequest>
) => {
  const { client, ready } = useRestateClient();
  return useMutation<AfterLoginResponse, Error, AfterLoginRequest>({
    mutationFn: async (args: AfterLoginRequest) => {
      if (!ready) {
        throw new Error('Client is not ready');
      }
      const response = await client({
        service: AUTH_SERVICE_NAME,
        method: 'afterLogin',
        body: args,
      });
      
      return response;
    },
    ...options,
  });
};
