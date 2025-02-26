import { Columns } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { columnsConfigSchema, columnsInputSchema, columnsOutputSchema } from './schema';
import { ColumnsEditor } from './editor';
import { ColumnsViewer } from './viewer';
import { ColumnsProperties } from './properties';
import { ColumnsToolbar } from './toolbar';

export const columnsComponent: ComponentDefinition<
  typeof columnsConfigSchema,
  typeof columnsInputSchema,
  typeof columnsOutputSchema
> = {
  type: 'columns',
  label: 'Columns',
  icon: Columns,
  category: 'layout',
  schema: {
    config: columnsConfigSchema,
    input: columnsInputSchema,
    output: columnsOutputSchema,
  },
  components: {
    Editor: ColumnsEditor,
    Viewer: ColumnsViewer,
    Properties: ColumnsProperties,
    Toolbar: ColumnsToolbar,
  },
}; 