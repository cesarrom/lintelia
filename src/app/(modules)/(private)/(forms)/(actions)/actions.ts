'use server'

import { inject } from "@/lib/injector/utils";
import { FormsService } from "@/lib/services/forms.service";
import OpenAI from 'openai';
import { env } from '@/lib/constants';
import { systemPrompt } from "./prompt";
import { FormConfig } from "../(components)/form-builder/schemas";
import { revalidatePath } from "next/cache";
import { FormInstance } from "@/lib/entities";
import { ReviewsService } from "@/lib/services/reviews.service";
import { LogsService } from "@/lib/services/logs.service";

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
    revalidatePath('/forms');
    return { ...result };
  }
);

export const updateForm = inject(
  [FormsService],
  async ({ }, [formsService], id: string, data: { name?: string, description?: string, config?: FormConfig }) => {
    const result = await formsService.update(id, data);
    revalidatePath('/forms');
    revalidatePath(`/forms/${id}`);
    return { ...result };
  }
);

export const listForms = inject(
  [FormsService],
  async ({ }, [formsService], search?: string) => {
    const results = await formsService.list(search);
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

export const getFormInstances = inject(
  [FormsService],
  async ({ }, [formsService], formId: string): Promise<FormInstance[]> => {
    const instances = await formsService.listInstances(formId);
    return instances.map(instance => ({ ...instance }));
  }
);

export const getFormInstance = inject(
  [FormsService],
  async ({ }, [formsService], instanceId: string) => {
    const instance = await formsService.getInstance(instanceId);
    if (!instance) throw new Error('Form instance not found');
    return { ...instance };
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

    revalidatePath(`/forms/${formId}`);
    return { ...instance };
  }
);

export const submitFormAnswers = inject(
  [FormsService, LogsService],
  async (context, [formsService, logsService], instanceId: string, answers: Record<string, unknown>) => {
    const instance = await formsService.getInstance(instanceId);

    if (!instance) throw new Error('Form instance not found');
    
    // Create form answers
    const formAnswer = await formsService.createAnswers({
      formId: instance.formId, // Using instanceId as formId since we're saving to the instance
      instanceId,
      answers,
    });

    // Update instance status to submitted
    await formsService.updateInstance(instanceId, {
      answers,
      status: 'submitted'
    });

    // Log the activity
    await logsService.create({
      message: 'Form answers submitted',
      category: 'form',
      level: 'info',
      metadata: {
        instanceId,
        answerId: formAnswer.id,
        formId: instance.formId,
        submittedBy: context.user?.userId || 'system'
      }
    });

    revalidatePath(`/forms/${instance.formId}`);
    return formAnswer;
  }
);

export const createReview = inject(
  [ReviewsService],
  async ({ user }, [reviewsService], data: {
    title: string;
    description?: string;
    reviewItems: Array<{ answer_id: string }>;
    nodeExecutionId: string;
  }) => {
    if (!user) throw new Error('User not authenticated');

    const review = await reviewsService.create({
      ...data,
      assignToUser: user.userId, // Auto-assign to creator
    });

    revalidatePath('/reviews');
    revalidatePath('/my-reviews');
    return { ...review };
  }
);