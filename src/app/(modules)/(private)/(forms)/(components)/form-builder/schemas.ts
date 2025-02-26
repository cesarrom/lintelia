import { z } from 'zod';

// Basic validation rule schemas
export const validationRuleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('minLength'),
    value: z.number(),
    message: z.string(),
  }),
  z.object({
    type: z.literal('maxLength'),
    value: z.number(),
    message: z.string(),
  }),
  z.object({
    type: z.literal('pattern'),
    value: z.string(),
    message: z.string(),
  }),
  // Add more validation types here
]);

// Component config schemas
export const baseComponentConfigSchema = z.object({
  label: z.string(),
  description: z.string().optional(),
  required: z.boolean().default(false),
  validation: z.array(validationRuleSchema).optional().default([]),
});

// Variable schema
export const formVariableSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  description: z.string().optional(),
  required: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
});

// Form component schema
export const formComponentSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.record(z.string(), z.unknown()),
});

// Complete form schema
export const formConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  variables: z.record(z.string(), formVariableSchema),
  components: z.array(formComponentSchema),
});

// Form values schema (for submitted data)
export const formValuesSchema = z.record(z.string(), z.unknown());

// Helper function to validate form config
export function validateFormConfig(config: unknown) {
  return formConfigSchema.safeParse(config);
}

// Helper function to create a field schema based on validation rules
function createFieldSchema(component: z.infer<typeof formComponentSchema>) {
  let schema = z.string();

  // Apply validation rules
  const validation = component.config.validation as z.infer<typeof validationRuleSchema>[] | undefined;
  if (validation) {
    validation.forEach(rule => {
      switch (rule.type) {
        case 'minLength':
          schema = schema.min(rule.value as number, rule.message);
          break;
        case 'maxLength':
          schema = schema.max(rule.value as number, rule.message);
          break;
        case 'pattern':
          schema = schema.regex(new RegExp(rule.value as string), rule.message);
          break;
      }
    });
  }

  // Make the field optional if not required
  return component.config.required ? schema : z.union([schema, z.literal('')]);
}

// Helper function to validate form values against a form config
export function validateFormValues(config: z.infer<typeof formConfigSchema>, values: unknown) {
  // Create a dynamic schema based on the form config
  const schemaShape = config.components.reduce((acc, component) => ({
    ...acc,
    [component.id]: createFieldSchema(component),
  }), {} as Record<string, z.ZodType>);

  const dynamicSchema = z.object(schemaShape);
  return dynamicSchema.safeParse(values);
}

// Types
export type ValidationRule = z.infer<typeof validationRuleSchema>;
export type BaseComponentConfig = z.infer<typeof baseComponentConfigSchema>;
export type FormVariable = z.infer<typeof formVariableSchema>;
export type FormComponent = z.infer<typeof formComponentSchema>;
export type FormConfig = z.infer<typeof formConfigSchema>;
export type FormValues = z.infer<typeof formValuesSchema>; 