import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const pageSeparatorConfigSchema = baseConfigSchema.extend({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
}).transform((data) => ({
  ...data,
  title: data.title || 'New Page',
  description: data.description ?? '',
}));

export type PageSeparatorConfig = z.infer<typeof pageSeparatorConfigSchema>;

// Value validation schema generator
export class PageSeparatorComponentSchema extends BaseComponentSchema<z.ZodString, PageSeparatorConfig> {
  constructor(propertyName: string) {
    super(z.string(), propertyName);
  }

  fromConfig(config: PageSeparatorConfig): this {
    // Page separators don't need validation as they're not input fields
    // But we still need to handle required flag for consistency
    this.setRequired(config.required);
    return this;
  }
}

export const pageSeparatorInputSchema = z.undefined();
export const pageSeparatorOutputSchema = z.undefined(); 