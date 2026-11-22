import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { UrlConfig } from '@repo/lintelia/schemas';

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