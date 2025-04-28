import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const phoneConfigSchema = baseConfigSchema.extend({
  type: z.literal('phone'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default('Enter your phone number'),
  description: z.string().optional().default(''),
  format: z.enum(['international', 'national']).default('international'),
  defaultCountry: z.string().default('US'),
});

export type PhoneConfig = z.infer<typeof phoneConfigSchema>;

// Value validation schema generator
export class PhoneComponentSchema extends BaseComponentSchema<z.ZodString, PhoneConfig> {
  constructor(propertyName: string) {
    super(z.string(), propertyName);
  }

  setPhoneValidation(): this {
    // Use a standard E.164 phone number validation
    this.schema = this.schema.regex(
      /^\+?[1-9]\d{1,14}$/, 
      'Please enter a valid phone number'
    );
    return this;
  }

  fromConfig(config: PhoneConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    this.setPhoneValidation();
    return this;
  }
} 