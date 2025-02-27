import { Calendar } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { DatetimeComponentSchema, datetimeConfigSchema, DatetimeConfig } from './schema';
import { DatetimeEditor } from './editor';
import { DatetimeViewer } from './viewer';
import { DatetimeProperties } from './properties';
import { DatetimeToolbar } from './toolbar';

/**
 * Datetime Input Component
 * 
 * A datetime input field that supports:
 * - Required/optional
 * - Date, time, or datetime format
 * - Min/max date validation
 */
export const datetimeComponent: IFormComponent = {
  type: 'datetime',
  label: 'Date & Time',
  icon: Calendar,
  category: 'input',

  // UI Components
  Editor: DatetimeEditor,
  Viewer: DatetimeViewer,
  Properties: DatetimeProperties,
  Toolbar: DatetimeToolbar,

  // Schema and validation
  getConfigSchema() {
    return datetimeConfigSchema;
  },

  createValidationSchema(config: DatetimeConfig) {
    const schema = new DatetimeComponentSchema(config.propertyName);
    
    // Apply validation rules from config
    schema.setRequired(config.required);
    if (config.validation?.min) {
      schema.setMinDate(config.validation.min);
    }
    if (config.validation?.max) {
      schema.setMaxDate(config.validation.max);
    }

    return schema;
  },
}; 