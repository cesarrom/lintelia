import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const passwordConfigSchema = baseComponentConfigSchema.extend({
  placeholder: z.string().optional().default('Enter your password'),
  showStrengthIndicator: z.boolean().default(false),
  minLength: z.number().min(1).default(8),
  requireNumbers: z.boolean().default(true),
  requireLetters: z.boolean().default(true),
  requireSymbols: z.boolean().default(false),
});

export const passwordInputSchema = z.string().optional();
export const passwordOutputSchema = z.string(); 