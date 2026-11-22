import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { RadioConfig, RadioOption } from '@repo/lintelia/schemas';

// Value validation schema generator
export class RadioComponentSchema extends BaseComponentSchema<z.ZodString, RadioConfig> {
  constructor(propertyName: string) {
    super(z.string(), propertyName);
  }

  setOptions(options: RadioOption[]): this {
    if (options && options.length > 0) {
      const validValues = options.map(option => option.value);
      // Cast to unknown first to avoid type errors
      this.schema = z.string().refine(
        (value) => validValues.includes(value),
        { message: `Value must be one of: ${validValues.join(', ')}` }
      ) as unknown as z.ZodString;
    }
    return this;
  }

  fromConfig(config: RadioConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    this.setOptions(config.options);
    return this;
  }
}