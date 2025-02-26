import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const timeConfigSchema = baseComponentConfigSchema.extend({
  placeholder: z.string().optional().default('Select time'),
  min: z.string().optional(), // HH:mm format
  max: z.string().optional(), // HH:mm format
  step: z.number().optional().default(60), // in seconds
});

// Time validation (HH:mm format)
const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

export const timeInputSchema = z.string().optional();
export const timeOutputSchema = z.string().regex(timeRegex, 'Please enter a valid time in 24-hour format (HH:mm)'); 