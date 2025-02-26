import { ListChecks } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { multiselectConfigSchema, multiselectInputSchema, multiselectOutputSchema } from './schema';
import { MultiselectEditor } from './editor';
import { MultiselectViewer } from './viewer';
import { MultiselectProperties } from './properties';
import { MultiselectToolbar } from './toolbar';

export const multiselectComponent: ComponentDefinition<
  typeof multiselectConfigSchema,
  typeof multiselectInputSchema,
  typeof multiselectOutputSchema
> = {
  type: 'multiselect',
  label: 'Multi-Select',
  icon: ListChecks,
  category: 'input',
  schema: {
    config: multiselectConfigSchema,
    input: multiselectInputSchema,
    output: multiselectOutputSchema,
  },
  components: {
    Editor: MultiselectEditor,
    Viewer: MultiselectViewer,
    Properties: MultiselectProperties,
    Toolbar: MultiselectToolbar,
  },
}; 