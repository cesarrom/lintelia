import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { EmailConfig } from '@repo/lintelia/schemas';

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

