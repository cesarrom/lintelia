import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const separatorConfigSchema = baseComponentConfigSchema.extend({
  showLabel: z.boolean().default(false),
});

// Separator doesn't have input/output as it's just a visual element
export const separatorInputSchema = z.null();
export const separatorOutputSchema = z.null(); 