import { Image } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { ImageComponentSchema } from './schema';
import { ImageConfig, imageConfigSchema } from '@repo/lintelia/schemas';
import { ImageEditor } from './editor';
import { ImageViewer } from './viewer';
import { ImageProperties } from './properties';
import { ImageToolbar } from './toolbar';

/**
 * Image Input Component
 * 
 * An image upload field that supports:
 * - Required/optional
 * - File type restrictions
 * - Size limits
 * - Dimension validations
 * - Aspect ratio validation
 */
export const imageComponent: IFormComponent = {
  type: 'image',
  label: 'Image Upload',
  icon: Image,
  category: 'input',

  // UI Components
  Editor: ImageEditor,
  Viewer: ImageViewer,
  Properties: ImageProperties,
  Toolbar: ImageToolbar,

  // Schema and validation
  getConfigSchema() {
    return imageConfigSchema;
  },

  createValidationSchema(config: ImageConfig) {
    const schema = new ImageComponentSchema(config.propertyName);
    
    // Apply validation rules from config
    schema.setRequired(config.required);
    schema.setDimensions(config);

    return schema;
  },
}; 