import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { SelectConfig, SelectOption } from '@repo/fintivio/schemas';

// Value validation schema generator
export class SelectComponentSchema extends BaseComponentSchema<z.ZodString, SelectConfig> {
  constructor(propertyName: string) {
    super(z.string(), propertyName);
  }

  setEnum(options: SelectOption[]): this {
    if (options.length > 0) {
      const values = options.map(option => option.value);
      this.schema = z.enum(values as [string, ...string[]]) as any;
    }
    return this;
  }

  fromConfig(config: SelectConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    
    // Set enum values for static options
    if (config.source.type === 'static' && config.source.options.length > 0) {
      this.setEnum(config.source.options);
    }
    
    return this;
  }
}