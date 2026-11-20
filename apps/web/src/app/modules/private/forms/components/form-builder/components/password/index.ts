import { KeyRound } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { PasswordComponentSchema } from './schema';
import { PasswordEditor } from './editor';
import { PasswordViewer } from './viewer';
import { PasswordProperties } from './properties';
import { PasswordToolbar } from './toolbar';
import { PasswordConfig, passwordConfigSchema } from '@repo/lintelia/schemas';

/**
 * Password Input Component
 * 
 * A password input field that supports:
 * - Required/optional
 * - Min/max length validation
 * - Pattern (regex) validation
 * - Show/hide password toggle
 */
export const passwordComponent: IFormComponent = {
  type: 'password',
  label: 'Password',
  icon: KeyRound,
  category: 'input',

  // UI Components
  Editor: PasswordEditor,
  Viewer: PasswordViewer,
  Properties: PasswordProperties,
  Toolbar: PasswordToolbar,

  // Schema and validation
  getConfigSchema() {
    return passwordConfigSchema;
  },

  createValidationSchema(config: PasswordConfig) {
    const schema = new PasswordComponentSchema(config.propertyName);
    
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