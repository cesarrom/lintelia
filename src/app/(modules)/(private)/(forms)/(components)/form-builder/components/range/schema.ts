import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const rangeConfigSchema = baseComponentConfigSchema.extend({
  min: z.number().default(0),
  max: z.number().default(100),
  step: z.number().default(1),
  showValue: z.boolean().default(true),
  valuePrefix: z.string().optional(),
  valueSuffix: z.string().optional(),
});

export const rangeInputSchema = z.number().optional();
export const rangeOutputSchema = z.number(); 