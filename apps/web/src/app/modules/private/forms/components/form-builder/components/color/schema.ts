import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { ColorConfig } from '@repo/lintelia/schemas';

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
