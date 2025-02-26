import { CalendarDays } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { dateConfigSchema, dateInputSchema, dateOutputSchema } from './schema';
import { DateEditor } from './editor';
import { DateViewer } from './viewer';
import { DateProperties } from './properties';
import { DateToolbar } from './toolbar';

export const dateComponent: ComponentDefinition<
  typeof dateConfigSchema,
  typeof dateInputSchema,
  typeof dateOutputSchema
> = {
  type: 'date',
  label: 'Date',
  icon: CalendarDays,
  category: 'input',
  schema: {
    config: dateConfigSchema,
    input: dateInputSchema,
    output: dateOutputSchema,
  },
  components: {
    Editor: DateEditor,
    Viewer: DateViewer,
    Properties: DateProperties,
    Toolbar: DateToolbar,
  },
}; 