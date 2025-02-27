import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const datetimeConfigSchema = baseConfigSchema.extend({
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  format: z.enum(['date', 'datetime', 'time']),
  validation: z.object({
    min: z.string().datetime().optional(),
    max: z.string().datetime().optional(),
  }).optional(),
}).transform((data) => ({
  ...data,
  description: data.description ?? '',
  placeholder: data.placeholder ?? '',
  format: data.format ?? 'datetime',
  validation: data.validation ?? {},
}));

export type DatetimeConfig = z.infer<typeof datetimeConfigSchema>;

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