import { Link } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { UrlComponentSchema } from './schema';
import { UrlEditor } from './editor';
import { UrlViewer } from './viewer';
import { UrlProperties } from './properties';
import { UrlToolbar } from './toolbar';
import { urlConfigSchema, UrlConfig } from '@repo/fintivio/schemas';

/**
 * URL Input Component
 * 
 * A URL input field that supports:
 * - Required/optional
 * - URL validation
 * - Custom prefix (e.g., https://)
 */
export const urlComponent: IFormComponent = {
  type: 'url',
  label: 'URL',
  icon: Link,
  category: 'input',

  // UI Components
  Editor: UrlEditor,
  Viewer: UrlViewer,
  Properties: UrlProperties,
  Toolbar: UrlToolbar,

  // Schema and validation
  getConfigSchema() {
    return urlConfigSchema;
  },

  createValidationSchema(config: UrlConfig) {
    const schema = new UrlComponentSchema(config.propertyName);
    
    // Apply validation rules from config
    schema.setRequired(config.required);
    schema.setUrlValidation();

    return schema;
  },
}; 