import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const dateConfigSchema = baseConfigSchema.extend({
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  defaultValue: z.string().date().optional(),
  validation: z.object({
    minDate: z.string().date().optional(),
    maxDate: z.string().date().optional(),
  }).optional(),
}).transform((data) => ({
  ...data,
  placeholder: data.placeholder ?? '',
  description: data.description ?? '',
  validation: data.validation ?? {},
}));

export type DateConfig = z.infer<typeof dateConfigSchema>;

// Value validation schema generator
export class DateComponentSchema extends BaseComponentSchema<z.ZodString, DateConfig> {
  constructor(propertyName: string) {
    super(z.string().date(), propertyName);
  }

  setMinDate(date: string | undefined): this {
    if (date) {
      const timestamp = new Date(date).getTime();
      const refined = this.schema.refine(
        (value) => new Date(value).getTime() >= timestamp,
        `Date must be after ${new Date(date).toLocaleDateString()}`
      );
      // Cast back to ZodString since we know it's still fundamentally a string schema
      this.schema = refined as unknown as z.ZodString;
    }
    return this;
  }

  setMaxDate(date: string | undefined): this {
    if (date) {
      const timestamp = new Date(date).getTime();
      const refined = this.schema.refine(
        (value) => new Date(value).getTime() <= timestamp,
        `Date must be before ${new Date(date).toLocaleDateString()}`
      );
      // Cast back to ZodString since we know it's still fundamentally a string schema
      this.schema = refined as unknown as z.ZodString;
    }
    return this;
  }

  fromConfig(config: DateConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    if (config.validation?.minDate) {
      this.setMinDate(config.validation.minDate);
    }
    if (config.validation?.maxDate) {
      this.setMaxDate(config.validation.maxDate);
    }
    return this;
  }
}

export const dateInputSchema = z.string().date().optional();
export const dateOutputSchema = z.string().date(); 