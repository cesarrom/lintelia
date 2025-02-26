import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const checkboxConfigSchema = baseComponentConfigSchema.extend({
  text: z.string().default('Check this box'),
  defaultChecked: z.boolean().default(false),
});

export const checkboxInputSchema = z.boolean().optional();
export const checkboxOutputSchema = z.boolean(); 