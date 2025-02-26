import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const pageSeparatorConfigSchema = baseComponentConfigSchema.extend({
  showPageNumber: z.boolean().default(true),
  showTitle: z.boolean().default(true),
});

export const pageSeparatorInputSchema = z.undefined();
export const pageSeparatorOutputSchema = z.undefined(); 