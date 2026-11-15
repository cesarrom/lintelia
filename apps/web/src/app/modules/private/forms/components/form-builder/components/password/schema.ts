import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { PasswordConfig } from '@repo/fintivio/schemas';

// Value validation schema generator
export class PasswordComponentSchema extends BaseComponentSchema<z.ZodString, PasswordConfig> {
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

  fromConfig(config: PasswordConfig): this {
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