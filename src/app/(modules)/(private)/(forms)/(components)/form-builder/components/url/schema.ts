import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const urlConfigSchema = baseConfigSchema.extend({
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  prefix: z.string().optional(),
}).transform((data) => ({
  ...data,
  placeholder: data.placeholder ?? 'Enter URL',
  description: data.description ?? '',
  prefix: data.prefix ?? 'https://',
}));

export type UrlConfig = z.infer<typeof urlConfigSchema>;

// Value validation schema generator
export class UrlComponentSchema extends BaseComponentSchema<z.ZodString, UrlConfig> {
  constructor(propertyName: string) {
    super(z.string(), propertyName);
  }

  setUrlValidation(): this {
    this.schema = this.schema.url('Please enter a valid URL');
    return this;
  }

  fromConfig(config: UrlConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    this.setUrlValidation();
    return this;
  }
}

export const urlInputSchema = z.string().optional();
export const urlOutputSchema = z.string().url('Please enter a valid URL'); 