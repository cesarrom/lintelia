'use client';

import { FileText } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { RichtextComponentSchema, richtextConfigSchema, RichtextConfig } from './schema';
import { RichtextEditor } from './editor';
import { RichtextViewer } from './viewer';
import { RichtextProperties } from './properties';
import { RichtextToolbar } from './toolbar';

/**
 * Rich Text Component
 * 
 * A rich text editor that supports:
 * - Required/optional
 * - HTML formatting
 * - Variable references
 */
export const richtextComponent: IFormComponent = {
  type: 'richtext',
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