import { z } from 'zod';

export const textConfigSchema = z.object({
  label: z.string().min(1, 'Label is required').default('Text Field'),
  placeholder: z.string().optional().default(''),
  description: z.string().optional().default(''),
  required: z.boolean().default(false),
  validation: z.array(
    z.object({
      type: z.enum(['minLength', 'maxLength', 'pattern']),
      value: z.union([z.string(), z.number()]),
      message: z.string()
    })
  ).optional().default([])
});

export const textInputSchema = z.string().optional();
export const textOutputSchema = z.string(); 