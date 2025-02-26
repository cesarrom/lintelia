import { Hash } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { numberConfigSchema, numberInputSchema, numberOutputSchema } from './schema';
import { NumberEditor } from './editor';
import { NumberViewer } from './viewer';
import { NumberProperties } from './properties';
import { NumberToolbar } from './toolbar';

export const numberComponent: ComponentDefinition<
  typeof numberConfigSchema,
  typeof numberInputSchema,
  typeof numberOutputSchema
> = {
  type: 'number',
  label: 'Number',
  icon: Hash,
  category: 'input',
  schema: {
    config: numberConfigSchema,
    input: numberInputSchema,
    output: numberOutputSchema,
  },
  components: {
    Editor: NumberEditor,
    Viewer: NumberViewer,
    Properties: NumberProperties,
    Toolbar: NumberToolbar,
  },
}; 