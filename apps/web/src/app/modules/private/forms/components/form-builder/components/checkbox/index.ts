import { CheckSquare } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { CheckboxComponentSchema } from './schema';
import { CheckboxEditor } from './editor';
import { CheckboxViewer } from './viewer';
import { CheckboxProperties } from './properties';
import { CheckboxToolbar } from './toolbar';
import { CheckboxConfig, checkboxConfigSchema } from '@repo/lintelia/schemas';

/**
 * Checkbox Input Component
 * 
 * A checkbox input field that supports:
 * - Required/optional
 * - Default value
 * - Custom label
 */
export const checkboxComponent: IFormComponent = {
  type: 'checkbox',
  label: 'Checkbox',
  icon: CheckSquare,
  category: 'input',

  // UI Components
  Editor: CheckboxEditor,
  Viewer: CheckboxViewer,
  Properties: CheckboxProperties,
  Toolbar: CheckboxToolbar,

  // Schema and validation
  getConfigSchema() {
    return checkboxConfigSchema;
  },

  createValidationSchema(config: CheckboxConfig) {
    const schema = new CheckboxComponentSchema(config.propertyName);
    
    // Apply validation rules from config
    schema.setRequired(config.required);

    return schema;
  },
}; 