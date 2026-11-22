import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import { useAxios } from './axios';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

/** Message of an API error (`{ error }` bodies), for toasts and inline alerts. */
export const apiErrorMessage = (error: unknown): string =>
  (error as any)?.response?.data?.error ?? (error as Error)?.message ?? 'Request failed';

/** Validation details (`{ errors: [...] }`, e.g. a workflow that cannot be published). */
export const apiErrorDetails = (error: unknown): string[] => {
  const errors = (error as any)?.response?.data?.errors;
  return Array.isArray(errors) ? errors.map(String) : [];
};

/** GET `path` (relative to the API) with the session; disabled while `path` is null. */
export function useApiQuery<T>(key: QueryKey, path: string | null, options: { refetchInterval?: number; enabled?: boolean; refetchOnWindowFocus?: boolean } = {}) {
  const { axios, ready } = useAxios();
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => (await axios.get(`${API_BASE_URL}${path}`)).data,
    enabled: ready && !!path && options.enabled !== false,
    refetchInterval: options.refetchInterval,
    refetchOnWindowFocus: options.refetchOnWindowFocus,
    staleTime: 0,
  });
}

/** A write; invalidates the given query key prefixes on success. */
export function useApiMutation<TInput = void, TResult = any>(
  request: (api: { axios: AxiosInstance; url: (path: string) => string }, input: TInput) => Promise<{ data: TResult }>,
  invalidate: QueryKey[] = [],
) {
  const { axios } = useAxios();
  const queryClient = useQueryClient();
  return useMutation<TResult, unknown, TInput>({
    mutationFn: async (input) => (await request({ axios, url: (path) => `${API_BASE_URL}${path}` }, input)).data,
    onSuccess: async () => {
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });
}
