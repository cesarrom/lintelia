import { Palette } from 'lucide-react';
import { z } from 'zod';
import { IFormComponent } from '../../schemas';
import { ColorComponentSchema, colorConfigSchema, ColorConfig } from './schema';
import { ColorEditor } from './editor';
import { ColorViewer } from './viewer';
import { ColorProperties } from './properties';
import { ColorToolbar } from './toolbar';

/**
 * Color Input Component
 * 
 * A color picker input field that supports:
 * - Required/optional
 * - Hex/RGB format
 * - Pattern (regex) validation
 * - Default value
 */
export const colorComponent: IFormComponent = {
  type: 'color',
  label: 'Color',
  icon: Palette,
  category: 'input',

  // UI Components
  Editor: ColorEditor,
  Viewer: ColorViewer,
  Properties: ColorProperties,
  Toolbar: ColorToolbar,

  // Schema and validation
  getConfigSchema() {
    return colorConfigSchema;
  },

  createValidationSchema(config: ColorConfig) {
    const schema = new ColorComponentSchema(config.propertyName);
    
    // Apply validation rules from config
    schema.setRequired(config.required);
    if (config.validation?.pattern) {
      schema.setPattern(config.validation.pattern);
    }

    return schema;
  },
}; 