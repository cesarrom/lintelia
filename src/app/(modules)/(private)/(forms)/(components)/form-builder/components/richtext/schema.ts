import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Define the variable reference schema
export const variableReferenceSchema = z.object({
  type: z.literal('variable'),
  id: z.string(),
  path: z.string().optional(),
});

export const fieldReferenceSchema = z.object({
  type: z.literal('field'),
  id: z.string(),
});

export const referenceSchema = z.discriminatedUnion('type', [
  variableReferenceSchema,
  fieldReferenceSchema,
]);

// Form builder config schema
export const richtextConfigSchema = baseConfigSchema.extend({
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  references: z.array(
    z.object({
      type: z.enum(['variable', 'field']),
      id: z.string(),
      label: z.string(),
    })
  ).optional(),
}).transform((data) => ({
  ...data,
  placeholder: data.placeholder ?? '',
  description: data.description ?? '',
  content: data.content ?? '',
  references: data.references ?? [],
}));

export type RichtextConfig = z.infer<typeof richtextConfigSchema>;

// Value validation schema generator
export class RichtextComponentSchema extends BaseComponentSchema<z.ZodString, RichtextConfig> {
  constructor(propertyName: string) {
    super(z.string(), propertyName);
  }

  fromConfig(config: RichtextConfig): this {
    // Apply validation rules from config
    this.setRequired(config.required);
    return this;
  }
}

// Input and output are strings (HTML content)
export const richtextInputSchema = z.string();
export const richtextOutputSchema = z.string(); 