import { SeparatorHorizontal } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { pageSeparatorConfigSchema, pageSeparatorInputSchema, pageSeparatorOutputSchema } from './schema';
import { PageSeparatorEditor } from './editor';
import { PageSeparatorViewer } from './viewer';
import { PageSeparatorProperties } from './properties';
import { PageSeparatorToolbar } from './toolbar';

export const pageSeparatorComponent: ComponentDefinition<
  typeof pageSeparatorConfigSchema,
  typeof pageSeparatorInputSchema,
  typeof pageSeparatorOutputSchema
> = {
  type: 'page-separator',
  label: 'Page Separator',
  icon: SeparatorHorizontal,
  category: 'layout',
  schema: {
    config: pageSeparatorConfigSchema,
    input: pageSeparatorInputSchema,
    output: pageSeparatorOutputSchema,
  },
  components: {
    Editor: PageSeparatorEditor,
    Viewer: PageSeparatorViewer,
    Properties: PageSeparatorProperties,
    Toolbar: PageSeparatorToolbar,
  },
}; 