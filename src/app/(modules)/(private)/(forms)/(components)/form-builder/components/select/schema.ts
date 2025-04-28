import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Define the option schema
export const selectOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
});

export type SelectOption = z.infer<typeof selectOptionSchema>;

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

export type OptionsSource = z.infer<typeof optionsSourceSchema>;

// Form builder config schema
export const selectConfigSchema = baseConfigSchema.extend({
  type: z.literal('select'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default('Select an option'),
  description: z.string().optional().default(''),
  source: optionsSourceSchema.default({
    type: 'static',
    options: [],
  }),
});

export type SelectConfig = z.infer<typeof selectConfigSchema>;

// Value validation schema generator
export class SelectComponentSchema extends BaseComponentSchema<z.ZodString, SelectConfig> {
  constructor(propertyName: string) {
    super(z.string(), propertyName);
  }

  setEnum(options: SelectOption[]): this {
    if (options.length > 0) {
      const values = options.map(option => option.value);
      this.schema = z.enum(values as [string, ...string[]]) as any;
    }
    return this;
  }

  fromConfig(config: SelectConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    
    // Set enum values for static options
    if (config.source.type === 'static' && config.source.options.length > 0) {
      this.setEnum(config.source.options);
    }
    
    return this;
  }
}

// Input can be undefined (no selection) or a string (selected value)
export const selectInputSchema = z.string().optional();

// Output must be a string when required, or undefined when optional
export const selectOutputSchema = z.string(); 