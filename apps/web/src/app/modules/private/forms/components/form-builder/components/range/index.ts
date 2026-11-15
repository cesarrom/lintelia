import { SlidersHorizontal } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { RangeComponentSchema } from './schema';
import { RangeEditor } from './editor';
import { RangeViewer } from './viewer';
import { RangeProperties } from './properties';
import { RangeToolbar } from './toolbar';
import { RangeConfig, rangeConfigSchema } from '@repo/fintivio/schemas';

/**
 * Range Input Component
 * 
 * A slider input field that supports:
 * - Required/optional
 * - Min/max values
 * - Step size
 * - Value display options
 */
export const rangeComponent: IFormComponent = {
  type: 'range',
  label: 'Range Slider',
  icon: SlidersHorizontal,
  category: 'input',

  // UI Components
  Editor: RangeEditor,
  Viewer: RangeViewer,
  Properties: RangeProperties,
  Toolbar: RangeToolbar,

  // Schema and validation
  getConfigSchema() {
    return rangeConfigSchema;
  },

  createValidationSchema(config: RangeConfig) {
    const schema = new RangeComponentSchema(config.propertyName);
    
    // Apply validation rules from config
    schema.setRequired(config.required);
    schema.setMin(config.min);
    schema.setMax(config.max);

    return schema;
  },
}; 