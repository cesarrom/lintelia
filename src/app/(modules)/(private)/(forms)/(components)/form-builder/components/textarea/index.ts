import { AlignLeft } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { textareaConfigSchema, textareaInputSchema, textareaOutputSchema } from './schema';
import { TextareaEditor } from './editor';
import { TextareaViewer } from './viewer';
import { TextareaProperties } from './properties';
import { TextareaToolbar } from './toolbar';

export const textareaComponent: ComponentDefinition<
  typeof textareaConfigSchema,
  typeof textareaInputSchema,
  typeof textareaOutputSchema
> = {
  type: 'textarea',
  label: 'Text Area',
  icon: AlignLeft,
  category: 'input',
  schema: {
    config: textareaConfigSchema,
    input: textareaInputSchema,
    output: textareaOutputSchema,
  },
  components: {
    Editor: TextareaEditor,
    Viewer: TextareaViewer,
    Properties: TextareaProperties,
    Toolbar: TextareaToolbar,
  },
};