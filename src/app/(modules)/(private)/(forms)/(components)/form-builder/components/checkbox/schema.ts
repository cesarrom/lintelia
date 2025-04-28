import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const checkboxConfigSchema = baseConfigSchema.extend({
  type: z.literal('checkbox'),
  label: z.string().optional(),
  description: z.string().optional(),
  text: z.string().default('Checkbox'),
  defaultChecked: z.boolean().default(false),
});

export type CheckboxConfig = z.infer<typeof checkboxConfigSchema>;

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

export const checkboxInputSchema = z.boolean().optional();
export const checkboxOutputSchema = z.boolean(); 