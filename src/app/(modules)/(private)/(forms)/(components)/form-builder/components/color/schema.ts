import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const colorConfigSchema = baseConfigSchema.extend({
  type: z.literal('color'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default(''),
  description: z.string().optional().default(''),
  defaultValue: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional(),
  format: z.enum(['hex', 'rgb']).default('hex'),
  validation: z.object({
    pattern: z.string().optional(),
  }).optional().default({}),
});

export type ColorConfig = z.infer<typeof colorConfigSchema>;

// Value validation schema generator
export class ColorComponentSchema extends BaseComponentSchema<z.ZodString, ColorConfig> {
  constructor(propertyName: string) {
    super(z.string(), propertyName);
  }

  setPattern(pattern: string | undefined): this {
    if (pattern) {
      try {
        const regex = new RegExp(pattern);
        this.schema = this.schema.regex(regex, 'Invalid format');
      } catch (e) {
        // Invalid regex, ignore
        console.warn('Invalid regex pattern:', pattern);
      }
    }
    return this;
  }

  fromConfig(config: ColorConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    if (config.validation?.pattern) {
      this.setPattern(config.validation.pattern);
    }
    return this;
  }
}

export const colorInputSchema = z.string().optional();
export const colorOutputSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'); 