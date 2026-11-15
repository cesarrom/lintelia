import { z } from 'zod';
import { BaseComponentSchema } from '../base-schema';
import { RatingConfig } from '@repo/fintivio/schemas';

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