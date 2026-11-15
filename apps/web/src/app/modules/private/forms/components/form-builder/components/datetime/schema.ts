import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { DatetimeConfig } from '@repo/fintivio/schemas';

// Value validation schema generator
export class DatetimeComponentSchema extends BaseComponentSchema<z.ZodString, DatetimeConfig> {
  constructor(propertyName: string) {
    super(z.string().datetime(), propertyName);
  }

  setMinDate(min: string | undefined): this {
    if (min) {
      this.schema = this.schema.datetime().min(new Date(min).getTime(), `Date must be after ${min}`);
    }
    return this;
  }

  setMaxDate(max: string | undefined): this {
    if (max) {
      this.schema = this.schema.datetime().max(new Date(max).getTime(), `Date must be before ${max}`);
    }
    return this;
  }

  fromConfig(config: DatetimeConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    if (config.validation?.min) {
      this.setMinDate(config.validation.min);
    }
    if (config.validation?.max) {
      this.setMaxDate(config.validation.max);
    }
    return this;
  }
}

export const datetimeInputSchema = z.string().datetime().optional();
export const datetimeOutputSchema = z.string().datetime(); // ISO datetime string 