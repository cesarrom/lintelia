import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

// Define the variable reference schema
export const variableReferenceSchema = z.object({
  type: z.literal('variable'),
  id: z.string(),
  path: z.string().optional(),
});

export const fieldReferenceSchema = z.object({
  type: z.literal('field'),
  id: z.string(),
});

export const referenceSchema = z.discriminatedUnion('type', [
  variableReferenceSchema,
  fieldReferenceSchema,
]);

// Extend the base config schema with rich text specific properties
export const richtextConfigSchema = baseComponentConfigSchema.extend({
  placeholder: z.string().optional().default('Enter text here...'),
  content: z.string().optional().default(''),
  references: z.array(referenceSchema).optional().default([]),
});

// Input and output are strings (HTML content)
export const richtextInputSchema = z.string();
export const richtextOutputSchema = z.string(); 