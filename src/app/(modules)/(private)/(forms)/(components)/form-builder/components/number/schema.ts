import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const numberConfigSchema = baseComponentConfigSchema.extend({
  placeholder: z.string().optional().default('Enter a number'),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  step: z.number().min(0).default(1),
  precision: z.number().min(0).max(10).default(0),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  allowNegative: z.boolean().default(true),
  format: z.enum(['decimal', 'integer', 'currency', 'percentage']).default('decimal'),
  currency: z.string().default('USD'),
});

export const numberInputSchema = z.number().optional();
export const numberOutputSchema = z.number(); 