import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const textareaConfigSchema = baseComponentConfigSchema.extend({
  placeholder: z.string().optional().default(''),
  rows: z.number().min(2).default(3),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  resizable: z.boolean().default(true),
});

export const textareaInputSchema = z.string().optional();
export const textareaOutputSchema = z.string(); 