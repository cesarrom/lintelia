import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const urlConfigSchema = baseComponentConfigSchema.extend({
  placeholder: z.string().optional().default('Enter URL'),
  prefix: z.string().optional().default('https://'),
});

// URL validation is handled by Zod's built-in URL validator
export const urlInputSchema = z.string().optional();
export const urlOutputSchema = z.string().url('Please enter a valid URL'); 