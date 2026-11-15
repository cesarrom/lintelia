import { useQuery, useMutation } from '@tanstack/react-query';
import { CreateFormRequest, CreateTestFormInstanceRequest, Form, FormAnswer, FormConfig, FormInstance, GenerateFormAIRequest, UpdateFormRequest, SubmitFormAnswersRequest } from '@repo/fintivio/schemas';
import { useAxios } from './axios';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL;

// --- Hooks ---

// generateFormWithAI
export const useFormGenerateFormWithAI = () => {
  const { axios } = useAxios()
  return useMutation({
    mutationFn: async (args: GenerateFormAIRequest): Promise<FormConfig> => {
      if (!axios) {
        throw new Error('Axios is not ready');
      }
      const response = await axios.post(`${API_BASE_URL}/forms/ai-generate`, args, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    },
  });
};

// createForm
export const useFormCreateForm = () => {
  const { axios } = useAxios()

  return useMutation({
    mutationFn: async (args: CreateFormRequest): Promise<Form> => {
      if (!axios) {
        throw new Error('Axios is not ready');
      }
      const response = await axios.post(`${API_BASE_URL}/forms`, args, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
  });
};

// updateForm
export const useFormUpdateForm = () => {
  const { axios } = useAxios()

  return useMutation({
    mutationFn: async (args: UpdateFormRequest): Promise<Form> => {
      // Backend expects PUT /forms, ID is in the body
      if (!axios) {
        throw new Error('Axios is not ready');
      }
      const response = await axios.put(`${API_BASE_URL}/forms`, args, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
  });
};

export const useFormGetAnswers = ({ instanceId, enabled = true }: { instanceId: string, enabled?: boolean }) => {
  const { axios, ready } = useAxios()

  return useQuery({
    queryKey: ['form', 'getAnswers', instanceId],
    queryFn: async (): Promise<FormAnswer[]> => {
      // Corrected URL and Method
      const response = await axios!.get(`${API_BASE_URL}/forms/instances/${instanceId}/answers`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: enabled && ready,
  });
};

// listForms
export const useFormListForms = ({ search, enabled = true }: {
  search?: string,
  enabled?: boolean
}) => {
  const { axios, ready } = useAxios()

  return useQuery({
    queryKey: ['form', 'listForms', search],
    queryFn: async (): Promise<Form[]> => {
      // Corrected URL, Method, and params handling
      const response = await axios!.get(`${API_BASE_URL}/forms`, {
        params: { search }, // Pass search as query param
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: enabled && ready,
  });
};

// getFormById
export const useFormGetFormById = ({
  id,
  enabled = true
}: {
  id: string,
  enabled?: boolean
}) => {
  const { axios, ready } = useAxios()

  return useQuery({
    queryKey: ['form', 'getFormById', id],
    queryFn: async (): Promise<Form | null> => {
      // Corrected URL and Method
      const response = await axios!.get(`${API_BASE_URL}/forms/${id}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: enabled && ready,
  });
};

// getFormInstances
export const useFormGetFormInstances = ({
  formId,
  enabled = true
}: {
  formId: string,
  enabled?: boolean
}) => {
  const { axios, ready } = useAxios()

  return useQuery({
    queryKey: ['form', 'getFormInstances', formId],
    queryFn: async (): Promise<FormInstance[]> => {
      // Corrected URL and Method
      const response = await axios!.get(`${API_BASE_URL}/forms/${formId}/instances`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: enabled && ready,
  });
};

// getFormInstance
export const useFormGetFormInstance = ({
  instanceId,
  enabled = true
}: {
  instanceId: string,
  enabled?: boolean
}) => {
  const { axios, ready } = useAxios()

  return useQuery({
    queryKey: ['form', 'getFormInstance', instanceId],
    queryFn: async (): Promise<FormInstance | null> => {
      // Corrected URL and Method
      const response = await axios!.get(`${API_BASE_URL}/forms/instances/${instanceId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
    enabled: enabled && ready,
  });
};

// createTestFormInstance
export const useFormCreateTestFormInstance = () => {
  const { axios } = useAxios()

  return useMutation({
    mutationFn: async (args: CreateTestFormInstanceRequest): Promise<FormInstance> => {
      // Corrected URL
      const response = await axios!.post(`${API_BASE_URL}/forms/${args.formId}/instances`, args, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
  });
};

// submitFormAnswers
export const useFormSubmitFormAnswers = () => {
  const { axios } = useAxios();

  return useMutation({
    mutationFn: async (args: SubmitFormAnswersRequest): Promise<{ answer: FormAnswer }> => {
      // Corrected URL
      const response = await axios!.post(`${API_BASE_URL}/forms/instances/${args.instanceId}/answers`, args, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    },
  });
};
