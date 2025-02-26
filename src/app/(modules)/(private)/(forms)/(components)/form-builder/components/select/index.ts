import { ListFilter } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { selectConfigSchema, selectInputSchema, selectOutputSchema } from './schema';
import { SelectEditor } from './editor';
import { SelectViewer } from './viewer';
import { SelectProperties } from './properties';
import { SelectToolbar } from './toolbar';

export const selectComponent: ComponentDefinition<
  typeof selectConfigSchema,
  typeof selectInputSchema,
  typeof selectOutputSchema
> = {
  type: 'select',
  label: 'Select',
  icon: ListFilter,
  category: 'input',
  schema: {
    config: selectConfigSchema,
    input: selectInputSchema,
    output: selectOutputSchema,
  },
  components: {
    Editor: SelectEditor,
    Viewer: SelectViewer,
    Properties: SelectProperties,
    Toolbar: SelectToolbar,
  },
};