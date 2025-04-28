import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const rangeConfigSchema = baseConfigSchema.extend({
  type: z.literal('range'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional().default(''),
  min: z.number().default(0),
  max: z.number().default(100),
  step: z.number().default(1),
  defaultValue: z.number().optional().default(0),
  showValue: z.boolean().default(true),
});

export type RangeConfig = z.infer<typeof rangeConfigSchema>;

// Value validation schema generator
export class RangeComponentSchema extends BaseComponentSchema<z.ZodNumber, RangeConfig> {
  constructor(propertyName: string) {
    super(z.number(), propertyName);
  }

  setMin(min: number): this {
    this.schema = this.schema.min(min, `Value must be at least ${min}`);
    return this;
  }

  setMax(max: number): this {
    this.schema = this.schema.max(max, `Value must be at most ${max}`);
    return this;
  }

  fromConfig(config: RangeConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    this.setMin(config.min);
    this.setMax(config.max);
    return this;
  }
}

export const rangeInputSchema = z.number().optional();
export const rangeOutputSchema = z.number(); 