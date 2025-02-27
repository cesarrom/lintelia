import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const ratingConfigSchema = baseConfigSchema.extend({
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional(),
  maxRating: z.number().min(1).max(10).default(5),
  showLabels: z.boolean().default(false),
  lowLabel: z.string().optional(),
  highLabel: z.string().optional(),
}).transform((data) => ({
  ...data,
  description: data.description ?? '',
  maxRating: data.maxRating ?? 5,
  showLabels: data.showLabels ?? false,
  lowLabel: data.lowLabel ?? 'Poor',
  highLabel: data.highLabel ?? 'Excellent',
}));

export type RatingConfig = z.infer<typeof ratingConfigSchema>;

// Value validation schema generator
export class RatingComponentSchema extends BaseComponentSchema<z.ZodNumber, RatingConfig> {
  constructor(propertyName: string) {
    super(z.number(), propertyName);
  }

  setMaxRating(maxRating: number): this {
    this.schema = this.schema.max(maxRating, `Maximum rating is ${maxRating}`);
    return this;
  }

  fromConfig(config: RatingConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    this.schema = this.schema.min(1, 'Please select a rating');
    this.setMaxRating(config.maxRating);
    return this;
  }
}

export const ratingInputSchema = z.number().min(0).optional();
export const ratingOutputSchema = z.number().min(1); 