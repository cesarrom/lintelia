import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { RichtextConfig } from '@repo/fintivio/schemas';

// Value validation schema generator
export class RichtextComponentSchema extends BaseComponentSchema<z.ZodString, RichtextConfig> {
  constructor(propertyName: string) {
    super(z.string(), propertyName);
  }

  fromConfig(config: RichtextConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    return this;
  }
}
