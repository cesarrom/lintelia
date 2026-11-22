import { Hash } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { NumberComponentSchema } from './schema';
import { NumberEditor } from './editor';
import { NumberViewer } from './viewer';
import { NumberProperties } from './properties';
import { NumberToolbar } from './toolbar';
import { NumberConfig, numberConfigSchema } from '@repo/lintelia/schemas';

/**
 * Number Input Component
 * 
 * A number input field that supports:
 * - Required/optional
 * - Min/max validation
 * - Step size
 * - Precision control
 */
export const numberComponent: IFormComponent = {
  type: 'number',
  label: 'Number Field',
  icon: Hash,
  category: 'input',

  // UI Components
  Editor: NumberEditor,
  Viewer: NumberViewer,
  Properties: NumberProperties,
  Toolbar: NumberToolbar,

  // Schema and validation
  getConfigSchema() {
    return numberConfigSchema;
  },

  createValidationSchema(config: NumberConfig) {
    const schema = new NumberComponentSchema(config.propertyName);
    
    // Apply validation rules from config
    schema.setRequired(config.required);
    if (config.validation?.min !== undefined) {
      schema.setMin(config.validation.min);
    }
    if (config.validation?.max !== undefined) {
      schema.setMax(config.validation.max);
    }
    if (config.validation?.step !== undefined) {
      schema.setStep(config.validation.step);
    }
    if (config.validation?.precision !== undefined) {
      schema.setPrecision(config.validation.precision);
    }

    return schema;
  },
}; 