import { FileText } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { FileComponentSchema } from './schema';
import { FileEditor } from './editor';
import { FileViewer } from './viewer';
import { FileProperties } from './properties';
import { FileToolbar } from './toolbar';
import { FileConfig, fileConfigSchema } from '@repo/fintivio/schemas';

/**
 * File Input Component
 * 
 * A file upload field that supports:
 * - Required/optional
 * - Single/multiple files
 * - File type restrictions
 * - File size limits
 * - Min/max file count validation
 */
export const fileComponent: IFormComponent = {
  type: 'file',
  label: 'File Upload',
  icon: FileText,
  category: 'input',

  // UI Components
  Editor: FileEditor,
  Viewer: FileViewer,
  Properties: FileProperties,
  Toolbar: FileToolbar,

  // Schema and validation
  getConfigSchema() {
    return fileConfigSchema;
  },

  createValidationSchema(config: FileConfig) {
    const schema = new FileComponentSchema(config.propertyName);
    return schema.fromConfig(config);
  },
}; 