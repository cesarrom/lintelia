import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const phoneConfigSchema = baseComponentConfigSchema.extend({
  placeholder: z.string().optional().default('Enter your phone number'),
  format: z.enum(['international', 'national']).default('international'),
  defaultCountry: z.string().default('US'),
});

export const phoneInputSchema = z.string().optional();
export const phoneOutputSchema = z.string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number'); 