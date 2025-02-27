import { Clock } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { TimeComponentSchema, timeConfigSchema, TimeConfig } from './schema';
import { TimeEditor } from './editor';
import { TimeViewer } from './viewer';
import { TimeProperties } from './properties';
import { TimeToolbar } from './toolbar';

/**
 * Time Input Component
 * 
 * A time input field that supports:
 * - Required/optional
 * - Min/max time validation
 * - Step (time interval) configuration
 */
export const timeComponent: IFormComponent = {
  type: 'time',
  label: 'Time',
  icon: Clock,
  category: 'input',

  // UI Components
  Editor: TimeEditor,
  Viewer: TimeViewer,
  Properties: TimeProperties,
  Toolbar: TimeToolbar,

  // Schema and validation
  getConfigSchema() {
    return timeConfigSchema;
  },

  createValidationSchema(config: TimeConfig) {
    return new TimeComponentSchema(config.propertyName).fromConfig(config);
  },
};