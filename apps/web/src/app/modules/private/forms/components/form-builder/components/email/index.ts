import { Mail } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { EmailComponentSchema } from './schema';
import { EmailEditor } from './editor';
import { EmailViewer } from './viewer';
import { EmailProperties } from './properties';
import { EmailToolbar } from './toolbar';
import { EmailConfig, emailConfigSchema } from '@repo/lintelia/schemas';

/**
 * Email Input Component
 * 
 * A specialized input field for email addresses that supports:
 * - Required/optional
 * - Email format validation
 * - Additional pattern (regex) validation
 */
export const emailComponent: IFormComponent = {
  type: 'email',
  label: 'Email',
  icon: Mail,
  category: 'input',

  // UI Components
  Editor: EmailEditor,
  Viewer: EmailViewer,
  Properties: EmailProperties,
  Toolbar: EmailToolbar,

  // Schema and validation
  getConfigSchema() {
    return emailConfigSchema;
  },

  createValidationSchema(config: EmailConfig) {
    const schema = new EmailComponentSchema(config.propertyName);
    
    // Apply validation rules from config
    schema.setRequired(config.required);
    if (config.validation?.pattern) {
      schema.setPattern(config.validation.pattern);
    }

    return schema;
  },
}; 