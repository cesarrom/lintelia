import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

// Define the option schema
export const selectOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
});

// Define the options source schema
const staticSourceSchema = z.object({
  type: z.literal('static'),
  options: z.array(selectOptionSchema).default([]),
});

const variableSourceSchema = z.object({
  type: z.literal('variable'),
  variableId: z.string().default(''),
  labelPath: z.string().optional(),
  valuePath: z.string().optional(),
});

export const optionsSourceSchema = z.discriminatedUnion('type', [
  staticSourceSchema,
  variableSourceSchema,
]);

// Extend the base config schema with select-specific properties
export const selectConfigSchema = baseComponentConfigSchema.extend({
  placeholder: z.string().optional().default('Select an option'),
  source: optionsSourceSchema.default({
    type: 'static',
    options: [],
  }),
});

// Input can be undefined (no selection) or a string (selected value)
export const selectInputSchema = z.string().optional();

// Output must be a string when required, or undefined when optional
export const selectOutputSchema = z.string(); 