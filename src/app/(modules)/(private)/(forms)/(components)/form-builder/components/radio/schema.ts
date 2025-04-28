import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Option schema for radio options
export const radioOptionSchema = z.object({
  label: z.string().min(1, 'Option label is required'),
  value: z.string().min(1, 'Option value is required'),
});

export type RadioOption = z.infer<typeof radioOptionSchema>;

// Form builder config schema
export const radioConfigSchema = baseConfigSchema.extend({
  type: z.literal('radio'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional().default(''),
  options: z.array(radioOptionSchema).min(1, 'At least one option is required').default([]),
  defaultValue: z.string().optional(),
  layout: z.enum(['horizontal', 'vertical']).default('vertical'),
});

export type RadioConfig = z.infer<typeof radioConfigSchema>;

// Value validation schema generator
export class RadioComponentSchema extends BaseComponentSchema<z.ZodString, RadioConfig> {
  constructor(propertyName: string) {
    super(z.string(), propertyName);
  }

  setOptions(options: RadioOption[]): this {
    if (options && options.length > 0) {
      const validValues = options.map(option => option.value);
      // Cast to unknown first to avoid type errors
      this.schema = z.string().refine(
        (value) => validValues.includes(value),
        { message: `Value must be one of: ${validValues.join(', ')}` }
      ) as unknown as z.ZodString;
    }
    return this;
  }

  fromConfig(config: RadioConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    this.setOptions(config.options);
    return this;
  }
}

export const radioInputSchema = z.string().optional();
export const radioOutputSchema = z.string(); 