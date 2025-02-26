import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const emailConfigSchema = baseComponentConfigSchema.extend({
  placeholder: z.string().optional().default('Enter your email address'),
});

// Email validation is handled by Zod's built-in email validator
export const emailInputSchema = z.string().optional();
export const emailOutputSchema = z.string().email('Please enter a valid email address'); 