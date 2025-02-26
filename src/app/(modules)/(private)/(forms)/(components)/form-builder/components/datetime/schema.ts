import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const datetimeConfigSchema = baseComponentConfigSchema.extend({
  placeholder: z.string().optional().default('Select date and time'),
  minDateTime: z.string().optional(), // ISO datetime string
  maxDateTime: z.string().optional(), // ISO datetime string
  disablePastDateTime: z.boolean().default(false),
  disableFutureDateTime: z.boolean().default(false),
  format: z.string().default('YYYY-MM-DD HH:mm'),
  showSeconds: z.boolean().default(false),
  use24Hour: z.boolean().default(true),
});

export const datetimeInputSchema = z.string().optional();
export const datetimeOutputSchema = z.string(); // ISO datetime string 