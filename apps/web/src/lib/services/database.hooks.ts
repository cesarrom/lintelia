import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DatabaseNodeConfig, GetTablesResponse } from '@repo/fintivio/schemas';
import { useAxios } from './axios';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL;

// --- DatabaseListTables ---
export const useDatabaseListTables = ({ enabled = true }: { enabled?: boolean }) => {
  const { axios, ready } = useAxios();
  return useQuery({
    queryKey: ['database', 'listTables'],
    queryFn: async (): Promise<string[]> => {
      const response = await axios!.get(`${API_BASE_URL}/databases/tables`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: enabled && ready,
  });
};



export const useDatabaseGetTableSchema = ({ tableName, enabled = true }: { tableName: string, enabled?: boolean }) => {
  const { axios, ready } = useAxios();
  return useQuery({
    queryKey: ['database', 'getTableSchema', tableName],
    queryFn: async (): Promise<GetTablesResponse> => {
      const response = await axios!.get(`${API_BASE_URL}/databases/schemas/${tableName}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: enabled && ready,
  });
};

// --- DatabaseExecuteQuery ---

export const useDatabaseExecuteQuery = () => {
  const { axios } = useAxios();
  return useMutation({
    mutationFn: async (config: DatabaseNodeConfig): Promise<any> => {
      const response = await axios!.post(`${API_BASE_URL}/databases/execute-query`, config, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
  });
};

// --- DatabaseCreateTableSchema ---
interface CreateTableSchemaParams {
  tableName: string;
  schema: GetTablesResponse; // The body of the request
}

export const useDatabaseCreateTableSchema = () => {
  const { axios } = useAxios();
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, CreateTableSchemaParams>({
    mutationFn: async ({ tableName, schema }: CreateTableSchemaParams) => {
      const response = await axios!.post(`${API_BASE_URL}/databases/schemas/${tableName}`, schema, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate queries to refetch table list and the specific table schema
      queryClient.invalidateQueries({ queryKey: ['database', 'listTables'] });
      queryClient.invalidateQueries({ queryKey: ['database', 'getTableSchema', variables.tableName] });
    },
  });
};
