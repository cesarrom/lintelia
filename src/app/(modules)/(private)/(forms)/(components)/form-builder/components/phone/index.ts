import { Phone } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { PhoneComponentSchema, phoneConfigSchema, PhoneConfig } from './schema';
import { PhoneEditor } from './editor';
import { PhoneViewer } from './viewer';
import { PhoneProperties } from './properties';
import { PhoneToolbar } from './toolbar';

/**
 * Phone Input Component
 * 
 * A phone number input field that supports:
 * - Required/optional
 * - International/national format
 * - Default country code
 * - E.164 validation
 */
export const phoneComponent: IFormComponent = {
  type: 'phone',
  label: 'Phone',
  icon: Phone,
  category: 'input',

  // UI Components
  Editor: PhoneEditor,
  Viewer: PhoneViewer,
  Properties: PhoneProperties,
  Toolbar: PhoneToolbar,

  // Schema and validation
  getConfigSchema() {
    return phoneConfigSchema;
  },

  createValidationSchema(config: PhoneConfig) {
    const schema = new PhoneComponentSchema(config.propertyName);
    return schema.fromConfig(config);
  },
}; 