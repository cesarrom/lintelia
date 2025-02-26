import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const colorConfigSchema = baseComponentConfigSchema.extend({
  defaultValue: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional(),
  format: z.enum(['hex', 'rgb']).default('hex'),
});

export const colorInputSchema = z.string().optional();
export const colorOutputSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'); 