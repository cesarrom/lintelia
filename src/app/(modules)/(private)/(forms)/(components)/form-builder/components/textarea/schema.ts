import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const textareaConfigSchema = baseConfigSchema.extend({
  type: z.literal('textarea'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default(''),
  description: z.string().optional().default(''),
  rows: z.number().min(2).default(4),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
  }).optional().default({}),
});

export type TextareaConfig = z.infer<typeof textareaConfigSchema>;

// Value validation schema generator
export class TextareaComponentSchema extends BaseComponentSchema<z.ZodString, TextareaConfig> {
  constructor(propertyName: string) {
    super(z.string(), propertyName);
  }

  setMinLength(length: number | undefined): this {
    if (length !== undefined && length > 0) {
      this.schema = this.schema.min(length, `Minimum length is ${length} characters`);
    } else {
      // Reset to base string schema while preserving other validations
      const isOptional = this.schema.isOptional();
      this.schema = z.string();
      if (isOptional) {
        this.schema = z.string().optional() as unknown as z.ZodString;
      }
    }
    return this;
  }

  setMaxLength(length: number | undefined): this {
    if (length !== undefined && length > 0) {
      this.schema = this.schema.max(length, `Maximum length is ${length} characters`);
    }
    return this;
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

  fromConfig(config: TextareaConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    if (config.validation?.minLength) {
      this.setMinLength(config.validation.minLength);
    }
    if (config.validation?.maxLength) {
      this.setMaxLength(config.validation.maxLength);
    }
    if (config.validation?.pattern) {
      this.setPattern(config.validation.pattern);
    }
    return this;
  }
}

export const textareaInputSchema = z.string().optional();
export const textareaOutputSchema = z.string(); 