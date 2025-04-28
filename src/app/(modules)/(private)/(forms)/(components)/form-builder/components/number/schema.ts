import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const numberConfigSchema = baseConfigSchema.extend({
  type: z.literal('number'),
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional().default(''),
  description: z.string().optional().default(''),
  defaultValue: z.number().optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    precision: z.number().int().min(0).max(10).optional(),
  }).optional().default({}),
});

export type NumberConfig = z.infer<typeof numberConfigSchema>;

// Value validation schema generator
export class NumberComponentSchema extends BaseComponentSchema<z.ZodNumber, NumberConfig> {
  constructor(propertyName: string) {
    super(z.number(), propertyName);
  }

  setMin(min: number | undefined): this {
    if (min !== undefined) {
      this.schema = this.schema.gte(min, `Value must be at least ${min}`);
    }
    return this;
  }

  setMax(max: number | undefined): this {
    if (max !== undefined) {
      this.schema = this.schema.lte(max, `Value must be at most ${max}`);
    }
    return this;
  }

  setStep(step: number | undefined): this {
    // Step is handled by the input element, not in validation
    return this;
  }

  setPrecision(precision: number | undefined): this {
    if (precision !== undefined) {
      // Use multipleOf to enforce precision
      const factor = Math.pow(10, -precision);
      this.schema = this.schema.multipleOf(factor, `Value must have at most ${precision} decimal places`);
    }
    return this;
  }

  fromConfig(config: NumberConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    if (config.validation?.min !== undefined) {
      this.setMin(config.validation.min);
    }
    if (config.validation?.max !== undefined) {
      this.setMax(config.validation.max);
    }
    if (config.validation?.step !== undefined) {
      this.setStep(config.validation.step);
    }
    if (config.validation?.precision !== undefined) {
      this.setPrecision(config.validation.precision);
    }
    return this;
  }
}

export const numberInputSchema = z.number().optional();
export const numberOutputSchema = z.number(); 