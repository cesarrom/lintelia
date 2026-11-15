import { useQuery, useMutation } from '@tanstack/react-query';
import { useAxios } from './axios';

// --- API Base URL Configuration ---
const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL;

// --- Hooks ---

/**
 * React Query mutation hook for uploading a file.
 * Corresponds to the `PUT /object` endpoint.
 */
export const useFilesPutObject = () => {
  const { axios, ready } = useAxios({ skipBodyModification: true });
  return useMutation<
    { success: boolean }, // Expected response type
    Error,                 // Error type
    File                   // Variables type (input to mutationFn)
  >({
    mutationFn: async (file: File): Promise<{ success: boolean }> => {
      if (!axios) {
        throw new Error('Axios is not ready');
      }
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.putForm(`${API_BASE_URL}/object`, formData);

      return response.data;
    },
  });
};


/**
 * React Query query hook for retrieving a file.
 * Corresponds to the `GET /object/:objectId` endpoint.
 * @param objectId The ID of the object/file to retrieve. Can be undefined or null if the query should be disabled.
 * @param options Optional query options, including `enabled`.
 */
export const useFilesGetObject = (
  { objectId, enabled = true }: { objectId: string | undefined | null, enabled?: boolean }
) => {
  const { axios, ready } = useAxios();
  return useQuery<
    File,                  // Expected response type
    Error,                 // Error type
    File,                  // Query data type (same as response for this hook)
    (string | null | undefined)[] // Query key type
  >({
    queryKey: ['files', 'getObject', objectId],
    queryFn: async (): Promise<File> => {
      const response = await axios!.get(`${API_BASE_URL}/object/${objectId}`);
      return new File([response.data], objectId || '');
    },
    enabled: enabled && ready, // Query is enabled only if objectId is truthy and enabled option is true
  });
};

export const useFilesGetUrl = (objectId: string | undefined | null) => {
  return `${API_BASE_URL}/object/${objectId}`
}
