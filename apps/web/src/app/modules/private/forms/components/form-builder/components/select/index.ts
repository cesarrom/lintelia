import { ListFilter } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { SelectComponentSchema } from './schema';
import { SelectEditor } from './editor';
import { SelectViewer } from './viewer';
import { SelectProperties } from './properties';
import { SelectToolbar } from './toolbar';
import { SelectConfig, selectConfigSchema } from '@repo/lintelia/schemas';

/**
 * Select Component
 * 
 * A dropdown select field that supports:
 * - Required/optional
 * - Static options
 * - Dynamic options from variables
 */
export const selectComponent: IFormComponent = {
  type: 'select',
  label: 'Select',
  icon: ListFilter,
  category: 'input',

  // UI Components
  Editor: SelectEditor,
  Viewer: SelectViewer,
  Properties: SelectProperties,
  Toolbar: SelectToolbar,

  // Schema and validation
  getConfigSchema() {
    return selectConfigSchema;
  },

  createValidationSchema(config: SelectConfig) {
    const schema = new SelectComponentSchema(config.propertyName);
    return schema.fromConfig(config);
  },
};