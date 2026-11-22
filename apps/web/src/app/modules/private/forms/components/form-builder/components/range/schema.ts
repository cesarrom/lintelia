import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { RangeConfig } from '@repo/lintelia/schemas';

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