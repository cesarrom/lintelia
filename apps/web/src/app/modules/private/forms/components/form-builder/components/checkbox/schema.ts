import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { CheckboxConfig } from '@repo/fintivio/schemas';

/**
 * Checkbox Component Schema
 * 
 * Extends the base component schema to provide checkbox-specific validation:
 * - Required/optional validation
 */
export class CheckboxComponentSchema extends BaseComponentSchema<z.ZodBoolean, CheckboxConfig> {
  constructor(propertyName: string) {
    super(z.boolean(), propertyName);
  }

  setRequired(required: boolean): this {
    if (required) {
      // Create a new boolean schema with the refinement
      const schema = z.boolean().refine(
        (value) => value === true,
        { message: 'This field must be checked' }
      );
      // Cast to unknown first to avoid type errors
      this.schema = schema as unknown as z.ZodBoolean;
    } else {
      this.schema = z.boolean();
    }
    return this;
  }

  fromConfig(config: CheckboxConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    return this;
  }
}
