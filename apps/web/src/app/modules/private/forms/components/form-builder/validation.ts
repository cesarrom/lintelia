import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { registry } from './registry';
import { FormConfig, formConfigSchema } from '@repo/lintelia/schemas';

// Helper function to validate form config
export function validateFormConfig(config: unknown) {
  return formConfigSchema.safeParse(config);
}

// Generate validation schema for form values
export function generateFormValuesSchema(config: FormConfig) {
  // First validate the form config to ensure we have valid component configs
  const validationResult = validateFormConfig(config);
  if (!validationResult.success) {
    throw validationResult.error;
  }

  const shape: Record<string, z.ZodType> = {};

  for (const component of validationResult.data.components) {
    const componentDef = registry.get(component.type);
    if (!componentDef) continue;
    if (!('propertyName' in component.config)) continue;

    const schema = componentDef.createValidationSchema(component.config);
    shape[component.config.propertyName as string] = schema.getSchema();
  }

  return z.object(shape);
}

// Helper function to generate validation schema for saving
export function generateValidationConfig(config: FormConfig): FormConfig {
  const validationSchema = generateFormValuesSchema(config);
  const validationRules = config.components.reduce((acc, component) => {
    const componentDef = registry.get(component.type);
    if (!componentDef) return acc;

    if ('propertyName' in component.config) {
      acc[component.config.propertyName as string] = {
        type: component.type,
        propertyName: component.config.propertyName,
        required: component.config.required,
        validation: 'validation' in component.config ? component.config.validation : {},
      };
    }
    return acc;
  }, {} as Record<string, unknown>);

  return {
    ...config,
    validation: {
      schema: zodToJsonSchema(validationSchema),
      rules: validationRules,
    },
  };
}

// Validate form values
export const validateFormValues = (
  config: FormConfig,
  values: Record<string, unknown>
) => {
  try {
    const schema = generateFormValuesSchema(config);
    return schema.safeParse(values);
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error : new Error('Unknown error during validation'),
    };
  }
}; 