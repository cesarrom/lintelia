'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchTables, fetchTableById, executeQuery, type QueryConfig } from './mock-data';

export function useTables() {
  return useQuery({
    queryKey: ['tables'],
    queryFn: fetchTables,
  });
}

export function useTable(id: string | undefined) {
  return useQuery({
    queryKey: ['table', id],
    queryFn: () => id ? fetchTableById(id) : Promise.resolve(undefined),
    enabled: !!id,
  });
}

export function useQueryExecution(tableId: string | undefined) {
  return useMutation({
    mutationFn: (query: QueryConfig) => {
      if (!tableId) throw new Error('No table selected');
      return executeQuery(tableId, query);
    },
  });
} 