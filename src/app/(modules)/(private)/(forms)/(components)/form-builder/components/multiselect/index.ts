import { ListFilter } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { MultiselectComponentSchema, multiselectConfigSchema, MultiselectConfig } from './schema';
import { MultiselectEditor } from './editor';
import { MultiselectViewer } from './viewer';
import { MultiselectProperties } from './properties';
import { MultiselectToolbar } from './toolbar';

/**
 * Multiselect Input Component
 * 
 * A multiselect input field that supports:
 * - Required/optional
 * - Min/max selection validation
 * - Static options, variable-based options, or API-based options
 * - Searchable options
 * - Create new options (creatable)
 */
export const multiselectComponent: IFormComponent = {
  type: 'multiselect',
  label: 'Multi Select',
  icon: ListFilter,
  category: 'input',

  // UI Components
  Editor: MultiselectEditor,
  Viewer: MultiselectViewer,
  Properties: MultiselectProperties,
  Toolbar: MultiselectToolbar,

  // Schema and validation
  getConfigSchema() {
    return multiselectConfigSchema;
  },

  createValidationSchema(config: MultiselectConfig) {
    const schema = new MultiselectComponentSchema(config.propertyName);
    
    // Apply validation rules from config
    schema.setRequired(config.required);
    schema.setMinSelect(config.minSelect);
    schema.setMaxSelect(config.maxSelect);

    return schema;
  },
}; 