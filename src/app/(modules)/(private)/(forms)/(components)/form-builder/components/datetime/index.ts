import { Clock } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { datetimeConfigSchema, datetimeInputSchema, datetimeOutputSchema } from './schema';
import { DateTimeEditor } from './editor';
import { DateTimeViewer } from './viewer';
import { DateTimeProperties } from './properties';
import { DateTimeToolbar } from './toolbar';

export const datetimeComponent: ComponentDefinition<
  typeof datetimeConfigSchema,
  typeof datetimeInputSchema,
  typeof datetimeOutputSchema
> = {
  type: 'datetime',
  label: 'Date & Time',
  icon: Clock,
  category: 'input',
  schema: {
    config: datetimeConfigSchema,
    input: datetimeInputSchema,
    output: datetimeOutputSchema,
  },
  components: {
    Editor: DateTimeEditor,
    Viewer: DateTimeViewer,
    Properties: DateTimeProperties,
    Toolbar: DateTimeToolbar,
  },
}; 