import { SeparatorHorizontal } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { SeparatorComponentSchema } from './schema';
import { SeparatorEditor } from './editor';
import { SeparatorViewer } from './viewer';
import { SeparatorProperties } from './properties';
import { SeparatorToolbar } from './toolbar';
import { SeparatorConfig, separatorConfigSchema } from '@repo/lintelia/schemas';

/**
 * Separator Component
 * 
 * A visual separator that can optionally display a title.
 * - Horizontal or vertical orientation
 * - Optional title display
 */
export const separatorComponent: IFormComponent = {
  type: 'separator',
  label: 'Separator',
  icon: SeparatorHorizontal,
  category: 'layout',

  // UI Components
  Editor: SeparatorEditor,
  Viewer: SeparatorViewer,
  Properties: SeparatorProperties,
  Toolbar: SeparatorToolbar,

  // Schema and validation
  getConfigSchema() {
    return separatorConfigSchema;
  },

  createValidationSchema(config: SeparatorConfig) {
    const schema = new SeparatorComponentSchema();
    return schema;
  },
}; 