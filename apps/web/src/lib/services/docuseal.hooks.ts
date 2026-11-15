import { useQuery } from '@tanstack/react-query';
import { DocusealTokenRequest, DocusealTokenResponse } from '@repo/fintivio/schemas';
import { useAxios } from './axios';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL;

// --- DatabaseListTables ---
export const useDocusealGetToken = ({ enabled = true, ...args }: DocusealTokenRequest & { enabled?: boolean }) => {
  const { axios, ready } = useAxios();
  return useQuery({
    queryKey: ['docuseal', 'getToken'],
    queryFn: async (): Promise<DocusealTokenResponse> => {
      const response = await axios!.put(`${API_BASE_URL}/docuseal/token`, args, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: enabled && ready,
  });
};