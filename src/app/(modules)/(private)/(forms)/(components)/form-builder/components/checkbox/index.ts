import { CheckSquare } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { checkboxConfigSchema, checkboxInputSchema, checkboxOutputSchema } from './schema';
import { CheckboxEditor } from './editor';
import { CheckboxViewer } from './viewer';
import { CheckboxProperties } from './properties';
import { CheckboxToolbar } from './toolbar';

export const checkboxComponent: ComponentDefinition<
  typeof checkboxConfigSchema,
  typeof checkboxInputSchema,
  typeof checkboxOutputSchema
> = {
  type: 'checkbox',
  label: 'Checkbox',
  icon: CheckSquare,
  category: 'input',
  schema: {
    config: checkboxConfigSchema,
    input: checkboxInputSchema,
    output: checkboxOutputSchema,
  },
  components: {
    Editor: CheckboxEditor,
    Viewer: CheckboxViewer,
    Properties: CheckboxProperties,
    Toolbar: CheckboxToolbar,
  },
}; 