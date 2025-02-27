import { z } from 'zod';
import { BaseComponentSchema, baseConfigSchema } from '../base-schema';

// Option schema for static options
export const multiselectOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

// Schema for options source configuration
export const optionsSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('static'),
    options: z.array(multiselectOptionSchema),
  }),
  z.object({
    type: z.literal('variable'),
    variableName: z.string(),
  }),
  z.object({
    type: z.literal('api'),
    endpoint: z.string(),
    labelPath: z.string(),
    valuePath: z.string(),
  }),
]);

// Form builder config schema
export const multiselectConfigSchema = baseConfigSchema.extend({
  label: z.string().min(1, 'Label is required'),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  source: optionsSourceSchema,
  defaultValue: z.array(z.string()).optional(),
  minSelect: z.number().min(0).optional(),
  maxSelect: z.number().min(0).optional(),
  searchable: z.boolean(),
  creatable: z.boolean(),
}).transform((data) => ({
  ...data,
  placeholder: data.placeholder ?? '',
  description: data.description ?? '',
  defaultValue: data.defaultValue ?? [],
  searchable: data.searchable ?? false,
  creatable: data.creatable ?? false,
}));

export type MultiselectConfig = z.infer<typeof multiselectConfigSchema>;

// Value validation schema generator
export class MultiselectComponentSchema extends BaseComponentSchema<z.ZodArray<z.ZodString>, MultiselectConfig> {
  constructor(propertyName: string) {
    super(z.array(z.string()), propertyName);
  }

  setMinSelect(min: number | undefined): this {
    if (min !== undefined && min > 0) {
      this.schema = this.schema.min(min, `Select at least ${min} option${min !== 1 ? 's' : ''}`);
    }
    return this;
  }

  setMaxSelect(max: number | undefined): this {
    if (max !== undefined && max > 0) {
      this.schema = this.schema.max(max, `Select at most ${max} option${max !== 1 ? 's' : ''}`);
    }
    return this;
  }

  fromConfig(config: MultiselectConfig): this {
    this.setRequired(config.required);
    this.setMinSelect(config.minSelect);
    this.setMaxSelect(config.maxSelect);
    return this;
  }
}

export const multiselectInputSchema = z.array(z.string()).optional();
export const multiselectOutputSchema = z.array(z.string()); 