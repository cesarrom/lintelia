import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Define the variable reference schema
export const variableReferenceSchema = z.object({
  type: z.literal('variable'),
  id: z.string(),
  path: z.string().optional(),
  label: z.string(),
});

export const fieldReferenceSchema = z.object({
  type: z.literal('field'),
  id: z.string(),
  label: z.string(),
});

export const systemReferenceSchema = z.object({
  type: z.literal('system'),
  id: z.string(),
  label: z.string(),
});

export const referenceSchema = z.discriminatedUnion('type', [
  variableReferenceSchema,
  fieldReferenceSchema,
  systemReferenceSchema,
]);

export type Reference = z.infer<typeof referenceSchema>;
export type VariableReference = z.infer<typeof variableReferenceSchema>;
export type FieldReference = z.infer<typeof fieldReferenceSchema>;
export type SystemReference = z.infer<typeof systemReferenceSchema>;

// Form builder config schema
export const richtextConfigSchema = baseConfigSchema.extend({
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  references: z.array(referenceSchema).optional(),
  enableVariables: z.boolean().optional(),
  enableFieldReferences: z.boolean().optional(),
  enableSystemVariables: z.boolean().optional(),
}).transform((data) => ({
  ...data,
  placeholder: data.placeholder ?? '',
  description: data.description ?? '',
  content: data.content ?? '',
  references: data.references ?? [],
  enableVariables: data.enableVariables ?? true,
  enableFieldReferences: data.enableFieldReferences ?? true,
  enableSystemVariables: data.enableSystemVariables ?? true,
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