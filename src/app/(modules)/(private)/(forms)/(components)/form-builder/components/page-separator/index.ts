import { SeparatorHorizontal } from 'lucide-react';
import { IFormComponent } from '../../schemas';
import { PageSeparatorComponentSchema, pageSeparatorConfigSchema, PageSeparatorConfig } from './schema';
import { PageSeparatorEditor } from './editor';
import { PageSeparatorViewer } from './viewer';
import { PageSeparatorProperties } from './properties';
import { PageSeparatorToolbar } from './toolbar';

/**
 * Page Separator Component
 * 
 * A component that separates form into multiple pages:
 * - Provides visual separation between form sections
 * - Can display page title and description
 * - Used for multi-page forms
 */
export const pageSeparatorComponent: IFormComponent = {
  type: 'page-separator',
  label: 'Page Separator',
  icon: SeparatorHorizontal,
  category: 'layout',

  // UI Components
  Editor: PageSeparatorEditor,
  Viewer: PageSeparatorViewer,
  Properties: PageSeparatorProperties,
  Toolbar: PageSeparatorToolbar,

  // Schema and validation
  getConfigSchema() {
    return pageSeparatorConfigSchema;
  },

  createValidationSchema(config: PageSeparatorConfig) {
    const schema = new PageSeparatorComponentSchema(config.propertyName);
    return schema.fromConfig(config);
  },
}; 