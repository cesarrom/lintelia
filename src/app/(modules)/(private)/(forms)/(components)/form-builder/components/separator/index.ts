import { SeparatorHorizontal } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { separatorConfigSchema, separatorInputSchema, separatorOutputSchema } from './schema';
import { SeparatorEditor } from './editor';
import { SeparatorViewer } from './viewer';
import { SeparatorProperties } from './properties';
import { SeparatorToolbar } from './toolbar';

export const separatorComponent: ComponentDefinition<
  typeof separatorConfigSchema,
  typeof separatorInputSchema,
  typeof separatorOutputSchema
> = {
  type: 'separator',
  label: 'Separator',
  icon: SeparatorHorizontal,
  category: 'layout',
  schema: {
    config: separatorConfigSchema,
    input: separatorInputSchema,
    output: separatorOutputSchema,
  },
  components: {
    Editor: SeparatorEditor,
    Viewer: SeparatorViewer,
    Properties: SeparatorProperties,
    Toolbar: SeparatorToolbar,
  },
}; 