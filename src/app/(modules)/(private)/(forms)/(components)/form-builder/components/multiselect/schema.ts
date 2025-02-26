import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

// Define the option schema
export const multiselectOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

// Define the options source schema
export const optionsSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('static'),
    options: z.array(multiselectOptionSchema),
  }),
  z.object({
    type: z.literal('variable'),
    variableId: z.string(),
    labelPath: z.string().optional(),
    valuePath: z.string().optional(),
  }),
]);

// Extend the base config schema with multiselect-specific properties
export const multiselectConfigSchema = baseComponentConfigSchema.extend({
  placeholder: z.string().optional().default('Select options...'),
  source: optionsSourceSchema.default({
    type: 'static',
    options: [],
  }),
  defaultValue: z.array(z.string()).optional(),
  minSelect: z.number().min(0).optional(),
  maxSelect: z.number().min(1).optional(),
  searchable: z.boolean().default(true),
  creatable: z.boolean().default(false),
});

export const multiselectInputSchema = z.array(z.string()).optional();
export const multiselectOutputSchema = z.array(z.string()); 