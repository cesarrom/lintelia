import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const ratingConfigSchema = baseComponentConfigSchema.extend({
  maxRating: z.number().min(1).max(10).default(5),
  showLabels: z.boolean().default(false),
  lowLabel: z.string().optional().default('Poor'),
  highLabel: z.string().optional().default('Excellent'),
});

export const ratingInputSchema = z.number().min(0).optional();
export const ratingOutputSchema = z.number().min(1); 