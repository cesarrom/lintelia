'use client';

import { FileText } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { RichtextComponentSchema } from './schema';
import { RichtextEditor } from './editor';
import { RichtextViewer } from './viewer';
import { RichtextProperties } from './properties';
import { RichtextToolbar } from './toolbar';
import { RichtextConfig, richtextConfigSchema } from '@repo/lintelia/schemas';

/**
 * Rich Text Component
 * 
 * A rich text editor that supports:
 * - Required/optional
 * - HTML formatting
 * - Variable references with autocomplete
 * - Form field references with autocomplete
 * - System variable references with autocomplete
 * - Real-time interpolation of variables and field values
 */
export const richtextComponent: IFormComponent = {
  type: 'richText',
  label: 'Rich Text',
  icon: FileText,
  category: 'input',

  // UI Components
  Editor: RichtextEditor,
  Viewer: RichtextViewer,
  Properties: RichtextProperties,
  Toolbar: RichtextToolbar,

  // Schema and validation
  getConfigSchema() {
    return richtextConfigSchema;
  },

  createValidationSchema(config: RichtextConfig) {
    const schema = new RichtextComponentSchema(config.propertyName);
    
    // Apply validation rules from config
    schema.setRequired(config.required);
    
    return schema;
  },
}; 