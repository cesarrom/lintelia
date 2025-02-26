'use server'

import { inject } from "@/lib/injector/utils";
import { FormsService } from "@/lib/services/forms.service";
import { FormConfig } from "@/types/form";
import OpenAI from 'openai';
import { env } from '@/lib/constants';
import { systemPrompt } from "./prompt";

export const generateFormWithAI = inject(
  [],
  async ({ }, [], prompt: string, existingConfig?: FormConfig) => {
    const openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    if (existingConfig) {
      messages.push({
        role: 'assistant',
        content: `Current form configuration: ${JSON.stringify(existingConfig, null, 2)}`
      });
    }

    try {
      const chatCompletion = await openai.chat.completions.create({
        messages: messages as any,
        model: 'gpt-4-turbo-preview',
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const reply = chatCompletion.choices[0].message.content;
      return { result: JSON.parse(reply || '{}') };
    } catch (error: any) {
      return { error: error.message || 'Failed to generate form configuration' };
    }
  }
);

export const createForm = inject(
  [FormsService],
  async ({ user }, [formsService], data: { name: string, description?: string, config: FormConfig }) => {
    const result = await formsService.create({
      ...data,
      createdBy: user!.userId,
    });
    return { ...result };
  }
);

export const updateForm = inject(
  [FormsService],
  async ({ }, [formsService], id: string, data: { name?: string, description?: string, config?: FormConfig }) => {
    const result = await formsService.update(id, data);
    return { ...result };
  }
);

export const listForms = inject(
  [FormsService],
  async ({ }, [formsService]) => {
    const results = await formsService.list();
    return results.map(form => ({ ...form }));
  }
);

export const getFormById = inject(
  [FormsService],
  async ({ }, [formsService], id: string) => {
    const result = await formsService.getById(id);
    return result ? { ...result } : null;
  }
);

export const createTestFormInstance = inject(
  [FormsService],
  async ({ user }, [formsService], formId: string, variables: Record<string, unknown> = {}) => {
    const instance = await formsService.createInstance({
      formId,
      variables,
      submittedBy: user!.userId,
    });

    return JSON.parse(JSON.stringify(instance));
  }
);

export const getFormInstance = inject(
  [FormsService],
  async ({ }, [formsService], instanceId: string) => {
    const instance = await formsService.getInstance(instanceId);
    if (!instance) throw new Error('Form instance not found');
    return JSON.parse(JSON.stringify(instance));
  }
);

export const submitFormAnswers = async (key: string, promiseId: string, answers: Record<string, unknown>) => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_URL}/resolvable/${key}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      promiseId,
      payload: answers,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit form answers');
  }

  return response.json();
}; 