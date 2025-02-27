import { AlignLeft } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { TextareaComponentSchema, textareaConfigSchema, TextareaConfig } from './schema';
import { TextareaEditor } from './editor';
import { TextareaViewer } from './viewer';
import { TextareaProperties } from './properties';
import { TextareaToolbar } from './toolbar';

/**
 * Textarea Component
 * 
 * A multi-line text input field that supports:
 * - Required/optional
 * - Min/max length validation
 * - Pattern (regex) validation
 * - Configurable number of rows
 */
export const textareaComponent: IFormComponent = {
  type: 'textarea',
  label: 'Text Area',
  icon: AlignLeft,
  category: 'input',

  // UI Components
  Editor: TextareaEditor,
  Viewer: TextareaViewer,
  Properties: TextareaProperties,
  Toolbar: TextareaToolbar,

  // Schema and validation
  getConfigSchema() {
    return textareaConfigSchema;
  },

  createValidationSchema(config: TextareaConfig) {
    const schema = new TextareaComponentSchema(config.propertyName);
    
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