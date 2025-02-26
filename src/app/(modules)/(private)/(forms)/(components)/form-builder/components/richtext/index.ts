import { ComponentDefinition } from '../../types';
import { RichtextEditor } from './editor';
import { RichtextViewer } from './viewer';
import { RichtextProperties } from './properties';
import { RichtextToolbar } from './toolbar';
import { richtextConfigSchema, richtextInputSchema, richtextOutputSchema } from './schema';
import { AlignLeft } from 'lucide-react';

export const richtextComponent: ComponentDefinition<
  typeof richtextConfigSchema,
  typeof richtextInputSchema,
  typeof richtextOutputSchema
> = {
  type: 'richtext',
  label: 'Rich Text',
  icon: AlignLeft,
  category: 'input',
  schema: {
    config: richtextConfigSchema,
    input: richtextInputSchema,
    output: richtextOutputSchema,
  },
  components: {
    Editor: RichtextEditor,
    Viewer: RichtextViewer,
    Properties: RichtextProperties,
    Toolbar: RichtextToolbar,
  },
}; 