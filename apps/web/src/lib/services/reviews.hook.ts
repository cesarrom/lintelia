import { useQuery, useMutation, UseQueryOptions, UseMutationOptions, QueryKey } from '@tanstack/react-query';
import type {
  Review,
  GetReviewsRequest,
  UpdateReviewsRequest,
  ApproveReviewRequest,
  RejectReviewRequest,
  RequestAdditionalDataRequest,
  CreateReviewRequest,
} from '@repo/fintivio/schemas';
import { useAxios } from './axios';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL;

interface GetAssignedReviewsArgs {
  userId: string;
}

interface GetReviewArgs {
  id: string;
}

interface AssignReviewArgs {
  id: string;
  assigneeId: string;
}

export const useReviewsCreateReviewMutation = (
  options?: UseMutationOptions<Review, Error, CreateReviewRequest>
) => {
  const { axios } = useAxios();
  return useMutation<Review, Error, CreateReviewRequest>({
    mutationFn: async (args: CreateReviewRequest): Promise<Review> => {
      const response = await axios.post(`${API_BASE_URL}/reviews`, args, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    ...options,
  });
};

export const useReviewsGetReviewsQuery = (
  args?: GetReviewsRequest,
  options?: Omit<UseQueryOptions<Review[], Error, Review[], QueryKey>, 'queryKey' | 'queryFn'>
) => {
  const { axios, ready } = useAxios();
  return useQuery<Review[], Error, Review[], QueryKey>({
    queryKey: ['reviews', 'getReviews', args || {}] as const,
    queryFn: async (): Promise<Review[]> => {
      const response = await axios.get(`${API_BASE_URL}/reviews`, {
        params: args,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: ready && options?.enabled !== false,
    ...options,
  });
};

export const useReviewsGetAssignedReviewsQuery = (
  args: GetAssignedReviewsArgs,
  options?: Omit<UseQueryOptions<Review[], Error, Review[], QueryKey>, 'queryKey' | 'queryFn'>
) => {
  const { userId } = args;
  const { axios, ready } = useAxios();
  return useQuery<Review[], Error, Review[], QueryKey>({
    queryKey: ['reviews', 'getAssignedReviews', userId] as const,
    queryFn: async (): Promise<Review[]> => {
      const response = await axios.get(`${API_BASE_URL}/reviews/assignees/${userId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: ready && !!userId && options?.enabled !== false,
    ...options,
  });
};

export const useReviewsGetReviewQuery = (
  args: GetReviewArgs,
  options?: Omit<UseQueryOptions<Review | null, Error, Review | null, QueryKey>, 'queryKey' | 'queryFn'>
) => {
  const { id } = args;
  const { axios, ready } = useAxios();
  return useQuery<Review | null, Error, Review | null, QueryKey>({
    queryKey: ['reviews', 'getReview', id] as const,
    queryFn: async (): Promise<Review | null> => {
      const response = await axios.get(`${API_BASE_URL}/reviews/${id}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.status === 404 ? null : response.data;
    },
    enabled: ready && !!id && options?.enabled !== false,
    ...options,
  });
};

export const useReviewsAssignReviewMutation = (
  options?: UseMutationOptions<Review, Error, AssignReviewArgs>
) => {
  const { axios } = useAxios();
  return useMutation<Review, Error, AssignReviewArgs>({
    mutationFn: async (args: AssignReviewArgs) => {
      const response = await axios.patch(`${API_BASE_URL}/reviews/${args.id}/assignees/${args.assigneeId}`, {}, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    ...options,
  });
};

export const useReviewsUpdateReviewMutation = (
  options?: UseMutationOptions<Review, Error, UpdateReviewsRequest>
) => {
  const { axios } = useAxios();
  return useMutation<Review, Error, UpdateReviewsRequest>({
    mutationFn: async (args: UpdateReviewsRequest) => {
      const { id, ...bodyData } = args;
      const response = await axios.put(`${API_BASE_URL}/reviews/${id}`, bodyData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    ...options,
  });
};

export const useReviewsApproveReviewMutation = (
  options?: UseMutationOptions<Review, Error, ApproveReviewRequest>
) => {
  const { axios } = useAxios();
  return useMutation<Review, Error, ApproveReviewRequest>({
    mutationFn: async (args: ApproveReviewRequest) => {
      const { id, ...bodyData } = args;
      const response = await axios.patch(`${API_BASE_URL}/reviews/${id}/approve`, bodyData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    ...options,
  });
};

export const useReviewsRejectReviewMutation = (
  options?: UseMutationOptions<Review, Error, RejectReviewRequest>
) => {
  const { axios } = useAxios();
  return useMutation<Review, Error, RejectReviewRequest>({
    mutationFn: async (args: RejectReviewRequest) => {
      const { id, ...bodyData } = args;
      const response = await axios.patch(`${API_BASE_URL}/reviews/${id}/reject`, bodyData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    ...options,
  });
};

export const useReviewsRequestAdditionalDataMutation = (
  options?: UseMutationOptions<Review, Error, RequestAdditionalDataRequest>
) => {
  const { axios } = useAxios();
  return useMutation<Review, Error, RequestAdditionalDataRequest>({
    mutationFn: async (args: RequestAdditionalDataRequest) => {
      const { id, ...bodyData } = args;
      const response = await axios.post(`${API_BASE_URL}/reviews/${id}/additional-data`, bodyData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    ...options,
  });
};