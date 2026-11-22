import { useQuery, useMutation } from '@tanstack/react-query';
import { LogsFilterRequest, Log, LogsAnalyticsResponse, TopUserLogsResponse, TopSourceLogsResponse, LogTrendsResponse, CreateLogRequest, AcknowledgeLogRequest } from '@repo/lintelia/schemas';
import { useAxios } from './axios';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL;
// --- Hooks ---

// getLogs
export const useLogsGetLogs = ({ filter, enabled = true }: { filter?: LogsFilterRequest, enabled?: boolean }) => {
  const { axios, ready } = useAxios();
  return useQuery({
    queryKey: ['logs', 'getLogs', filter],
    queryFn: async (): Promise<Log[]> => {
      const response = await axios.get(`${API_BASE_URL}/logs`, {
        params: filter, // Pass filter as query params
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: ready && enabled,
  });
};

// getLog
export const useLogsGetLog = ({ id, enabled = true }: { id: string, enabled?: boolean }) => {
  const { axios, ready } = useAxios();
  return useQuery({
    queryKey: ['logs', 'getLog', id],
    queryFn: async (): Promise<Log> => {
      const response = await axios.get(`${API_BASE_URL}/logs/${id}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: ready && enabled && !!id,
  });
};

// createLog
export const useLogsCreateLog = () => {
  const { axios } = useAxios();
  return useMutation({
    mutationFn: async (data: CreateLogRequest): Promise<Log> => {
      const response = await axios.post(`${API_BASE_URL}/logs`, data, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
  });
};

// acknowledgeLog
export const useLogsAcknowledgeLog = () => {
  const { axios } = useAxios();
  return useMutation({
    mutationFn: async ({ id, userId }: AcknowledgeLogRequest): Promise<boolean> => {
      // Backend expects PATCH /logs/:logId/acknowledge
      const response = await axios.patch(`${API_BASE_URL}/logs/${id}/acknowledge`, { userId }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
  });
};

// getLogsAnalytics
export const useLogsGetLogsAnalytics = ({ filter, enabled = true }: { filter?: LogsFilterRequest, enabled?: boolean }) => {
  const { axios, ready } = useAxios();
  return useQuery({
    queryKey: ['logs', 'getLogsAnalytics', filter],
    queryFn: async (): Promise<LogsAnalyticsResponse> => {
      const response = await axios.get(`${API_BASE_URL}/logs/analytics`, {
        params: filter, // Pass filter as query params
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: ready && enabled,
  });
};

// getTopUsers
export const useLogsGetTopUsers = ({ limit = 10, enabled = true }: { limit?: number, enabled?: boolean }) => {
  const { axios, ready } = useAxios();
  return useQuery({
    queryKey: ['logs', 'getTopUsers', limit],
    queryFn: async (): Promise<TopUserLogsResponse[]> => {
      const response = await axios.get(`${API_BASE_URL}/logs/top-users`, {
        params: { limit }, // Pass limit as query param
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: ready && enabled,
  });
};

// getTopSources
export const useLogsGetTopSources = ({ limit = 10, enabled = true }: { limit?: number, enabled?: boolean }) => {
  const { axios, ready } = useAxios();
  return useQuery({
    queryKey: ['logs', 'getTopSources', limit],
    queryFn: async (): Promise<TopSourceLogsResponse[]> => {
      const response = await axios.get(`${API_BASE_URL}/logs/top-sources`, {
        params: { limit }, // Pass limit as query param
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: ready && enabled,
  });
};

// getLogsTrend
export const useLogsGetLogsTrend = ({ days = 30, enabled = true }: { days?: number, enabled?: boolean }) => {
  const { axios, ready } = useAxios();
  return useQuery({
    queryKey: ['logs', 'getLogsTrend', days],
    queryFn: async (): Promise<LogTrendsResponse[]> => {
      const response = await axios.get(`${API_BASE_URL}/logs/trends`, {
        params: { days }, // Pass days as query param
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: ready && enabled,
  });
};
