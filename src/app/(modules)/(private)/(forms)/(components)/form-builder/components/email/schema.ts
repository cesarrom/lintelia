import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const emailConfigSchema = baseConfigSchema.extend({
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  validation: z.object({
    pattern: z.string().optional(), // Additional email pattern if needed
  }).optional(),
}).transform((data) => ({
  ...data,
  placeholder: data.placeholder ?? '',
  description: data.description ?? '',
  validation: data.validation ?? {},
}));

export type EmailConfig = z.infer<typeof emailConfigSchema>;

// Value validation schema generator
export class EmailComponentSchema extends BaseComponentSchema<z.ZodString, EmailConfig> {
  constructor(propertyName: string) {
    // Use Zod's built-in email validation instead of refine
    super(z.string().email('Invalid email address'), propertyName);
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

  fromConfig(config: EmailConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    if (config.validation?.pattern) {
      this.setPattern(config.validation.pattern);
    }
    return this;
  }
}

// Email validation is handled by Zod's built-in email validator
export const emailInputSchema = z.string().optional();
export const emailOutputSchema = z.string().email('Please enter a valid email address'); 