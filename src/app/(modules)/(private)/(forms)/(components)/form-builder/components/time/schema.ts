import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const timeConfigSchema = baseConfigSchema.extend({
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  min: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format').optional(),
  max: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format').optional(),
  step: z.number().optional(),
}).transform((data) => ({
  ...data,
  placeholder: data.placeholder ?? 'Select time',
  description: data.description ?? '',
  step: data.step ?? 60, // Default step is 60 seconds (1 minute)
}));

export type TimeConfig = z.infer<typeof timeConfigSchema>;

// Time validation (HH:mm format)
const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Time Component Schema
 * 
 * Extends the base component schema to provide time-specific validation:
 * - Required/optional validation
 * - Min/max time validation
 */
export class TimeComponentSchema extends BaseComponentSchema<z.ZodString, TimeConfig> {
  constructor(propertyName: string) {
    super(z.string().regex(timeRegex, 'Please enter a valid time in 24-hour format (HH:mm)'), propertyName);
  }

  setMinTime(min: string | undefined): this {
    if (min && timeRegex.test(min)) {
      // Create a new schema with the refinement
      const newSchema = this.schema.refine(
        (time) => !time || time >= min,
        { message: `Time must be after ${min}` }
      );
      // Cast to unknown first to avoid type errors
      this.schema = newSchema as unknown as z.ZodString;
    }
    return this;
  }

  setMaxTime(max: string | undefined): this {
    if (max && timeRegex.test(max)) {
      // Create a new schema with the refinement
      const newSchema = this.schema.refine(
        (time) => !time || time <= max,
        { message: `Time must be before ${max}` }
      );
      // Cast to unknown first to avoid type errors
      this.schema = newSchema as unknown as z.ZodString;
    }
    return this;
  }

  fromConfig(config: TimeConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    this.setMinTime(config.min);
    this.setMaxTime(config.max);
    return this;
  }
} 