import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { PhoneConfig } from '@repo/lintelia/schemas';

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