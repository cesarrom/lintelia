import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const dateConfigSchema = baseComponentConfigSchema.extend({
  placeholder: z.string().optional().default('Select a date'),
  minDate: z.string().optional(), // ISO date string
  maxDate: z.string().optional(), // ISO date string
  disablePastDates: z.boolean().default(false),
  disableFutureDates: z.boolean().default(false),
  format: z.string().default('YYYY-MM-DD'),
});

export const dateInputSchema = z.string().optional();
export const dateOutputSchema = z.string(); // ISO date string 