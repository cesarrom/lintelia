import { Radio } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { RadioComponentSchema } from './schema';
import { RadioEditor } from './editor';
import { RadioViewer } from './viewer';
import { RadioProperties } from './properties';
import { RadioToolbar } from './toolbar';
import { radioConfigSchema, RadioConfig } from '@repo/lintelia/schemas';

/**
 * Radio Input Component
 * 
 * A radio button group that supports:
 * - Required/optional
 * - Multiple options
 * - Horizontal/vertical layout
 * - Default value
 */
export const radioComponent: IFormComponent = {
  type: 'radio',
  label: 'Radio Group',
  icon: Radio,
  category: 'input',

  // UI Components
  Editor: RadioEditor,
  Viewer: RadioViewer,
  Properties: RadioProperties,
  Toolbar: RadioToolbar,

  // Schema and validation
  getConfigSchema() {
    return radioConfigSchema;
  },

  createValidationSchema(config: RadioConfig) {
    const schema = new RadioComponentSchema(config.propertyName);
    
    // Apply validation rules from config
    schema.setRequired(config.required);
    schema.setOptions(config.options);

    return schema;
  },
}; 