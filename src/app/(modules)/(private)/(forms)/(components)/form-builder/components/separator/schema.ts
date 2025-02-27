import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Form builder config schema
export const separatorConfigSchema = baseConfigSchema.extend({
  title: z.string().optional(),
  showTitle: z.boolean().default(false),
  orientation: z.enum(['horizontal', 'vertical']).default('horizontal'),
}).transform((data) => ({
  ...data,
  title: data.title ?? '',
  showTitle: data.showTitle ?? false,
  orientation: data.orientation ?? 'horizontal',
}));

export type SeparatorConfig = z.infer<typeof separatorConfigSchema>;

// Value validation schema generator
export class SeparatorComponentSchema extends BaseComponentSchema<z.ZodNull, SeparatorConfig> {
  constructor(propertyName: string) {
    super(z.null(), propertyName);
  }

  fromConfig(config: SeparatorConfig): this {
    // Separator doesn't need validation as it's just a visual element
    return this;
  }
}

// Separator doesn't have input/output as it's just a visual element
export const separatorInputSchema = z.null();
export const separatorOutputSchema = z.null(); 