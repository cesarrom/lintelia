import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

// Define the option type
const optionSchema = z.object({
  label: z.string(),
  value: z.string(),
  description: z.string().optional(),
});

export const radioConfigSchema = baseComponentConfigSchema.extend({
  options: z.array(optionSchema).min(1, 'At least one option is required').default([]),
  layout: z.enum(['horizontal', 'vertical']).default('vertical'),
});

export const radioInputSchema = z.string().optional();
export const radioOutputSchema = z.string(); 