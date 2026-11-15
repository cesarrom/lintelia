import { Calendar } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { DateComponentSchema } from './schema';
import { DateEditor } from './editor';
import { DateViewer } from './viewer';
import { DateProperties } from './properties';
import { DateToolbar } from './toolbar';
import { DateConfig, dateConfigSchema } from '@repo/fintivio/schemas';

/**
 * Date Input Component
 * 
 * A date picker input field that supports:
 * - Required/optional
 * - Min/max date validation
 * - Default value
 */
export const dateComponent: IFormComponent = {
  type: 'date',
  label: 'Date',
  icon: Calendar,
  category: 'input',

  // UI Components
  Editor: DateEditor,
  Viewer: DateViewer,
  Properties: DateProperties,
  Toolbar: DateToolbar,

  // Schema and validation
  getConfigSchema() {
    return dateConfigSchema;
  },

  createValidationSchema(config: DateConfig) {
    const schema = new DateComponentSchema(config.propertyName);
    
    // Apply validation rules from config
    schema.setRequired(config.required);
    if (config.validation?.minDate) {
      schema.setMinDate(config.validation.minDate);
    }
    if (config.validation?.maxDate) {
      schema.setMaxDate(config.validation.maxDate);
    }

    return schema;
  },
}; 