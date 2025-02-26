import { Type } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { textConfigSchema, textInputSchema, textOutputSchema } from './schema';
import { TextEditor } from './editor';
import { TextViewer } from './viewer';
import { TextProperties } from './properties';
import { TextToolbar } from './toolbar';

export const textComponent: ComponentDefinition<
  typeof textConfigSchema,
  typeof textInputSchema,
  typeof textOutputSchema
> = {
  type: 'text',
  label: 'Text',
  icon: Type,
  category: 'input',
  schema: {
    config: textConfigSchema,
    input: textInputSchema,
    output: textOutputSchema,
  },
  components: {
    Editor: TextEditor,
    Viewer: TextViewer,
    Properties: TextProperties,
    Toolbar: TextToolbar,
  },
}; 