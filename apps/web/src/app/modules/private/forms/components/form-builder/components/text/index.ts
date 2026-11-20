import { Type } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { TextComponentSchema } from './schema';
import { TextEditor } from './editor';
import { TextViewer } from './viewer';
import { TextProperties } from './properties';
import { TextToolbar } from './toolbar';
import { TextConfig, textConfigSchema } from '@repo/lintelia/schemas';

/**
 * Text Input Component
 * 
 * A simple text input field that supports:
 * - Required/optional
 * - Min/max length validation
 * - Pattern (regex) validation
 */
export const textComponent: IFormComponent = {
  type: 'text',
  label: 'Text Field',
  icon: Type,
  category: 'input',

  // UI Components
  Editor: TextEditor,
  Viewer: TextViewer,
  Properties: TextProperties,
  Toolbar: TextToolbar,

  // Schema and validation
  getConfigSchema() {
    return textConfigSchema;
  },

  createValidationSchema(config: TextConfig) {
    const schema = new TextComponentSchema(config.propertyName);
    
    // Apply validation rules from config
    schema.setRequired(config.required);
    if (config.validation?.minLength) {
      schema.setMinLength(config.validation.minLength);
    }
    if (config.validation?.maxLength) {
      schema.setMaxLength(config.validation.maxLength);
    }
    if (config.validation?.pattern) {
      schema.setPattern(config.validation.pattern);
    }

    return schema;
  },
}; 