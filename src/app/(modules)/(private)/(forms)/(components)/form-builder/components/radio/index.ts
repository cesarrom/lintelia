import { Radio } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { radioConfigSchema, radioInputSchema, radioOutputSchema } from './schema';
import { RadioEditor } from './editor';
import { RadioViewer } from './viewer';
import { RadioProperties } from './properties';
import { RadioToolbar } from './toolbar';

export const radioComponent: ComponentDefinition<
  typeof radioConfigSchema,
  typeof radioInputSchema,
  typeof radioOutputSchema
> = {
  type: 'radio',
  label: 'Radio',
  icon: Radio,
  category: 'input',
  schema: {
    config: radioConfigSchema,
    input: radioInputSchema,
    output: radioOutputSchema,
  },
  components: {
    Editor: RadioEditor,
    Viewer: RadioViewer,
    Properties: RadioProperties,
    Toolbar: RadioToolbar,
  },
}; 