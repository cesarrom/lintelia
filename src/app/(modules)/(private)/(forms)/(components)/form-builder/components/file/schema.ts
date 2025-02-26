import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const fileConfigSchema = baseComponentConfigSchema.extend({
  placeholder: z.string().optional().default('Click or drag files here'),
  description: z.string().optional().default('Upload your files'),
  accept: z.string().optional().default('*/*'),
  maxFiles: z.number().min(1).default(1),
  maxSize: z.number().min(1).default(5 * 1024 * 1024), // 5MB
  minSize: z.number().min(0).default(0),
  allowMultiple: z.boolean().default(false),
});

export const fileInputSchema = z.array(z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
  url: z.string(),
})).optional();

export const fileOutputSchema = z.array(z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
  url: z.string(),
})); 