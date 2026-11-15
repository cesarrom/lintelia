import { useQuery, useMutation, UseQueryOptions, UseMutationOptions, QueryKey } from '@tanstack/react-query';
import type { AfterLoginRequest, AfterLoginResponse } from '@repo/fintivio/schemas';
import { useAxios } from './axios';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL;

/** Role keys of the current user in the current tenant. */
export const useAuthGetUserRolesQuery = (
  options?: Omit<UseQueryOptions<string[], Error, string[], QueryKey>, 'queryKey' | 'queryFn'>
) => {
  const { axios, ready } = useAxios();
  return useQuery<string[], Error, string[], QueryKey>({
    queryKey: ['auth', 'getUserRoles'] as const,
    queryFn: async (): Promise<string[]> => (await axios.get(`${API_BASE_URL}/auth/roles`)).data,
    ...options,
    enabled: (options?.enabled ?? true) && ready,
  });
};

/** Records the sign-in event and returns where to go next. */
export const useAuthAfterLoginMutation = (
  options?: UseMutationOptions<AfterLoginResponse, Error, AfterLoginRequest>
) => {
  const { axios } = useAxios();
  return useMutation<AfterLoginResponse, Error, AfterLoginRequest>({
    mutationFn: async (args: AfterLoginRequest) => (await axios.post(`${API_BASE_URL}/auth/after-login`, args)).data,
    ...options,
  });
};
