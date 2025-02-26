import { Clock } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { timeConfigSchema, timeInputSchema, timeOutputSchema } from './schema';
import { TimeEditor } from './editor';
import { TimeViewer } from './viewer';
import { TimeProperties } from './properties';
import { TimeToolbar } from './toolbar';

export const timeComponent: ComponentDefinition<
  typeof timeConfigSchema,
  typeof timeInputSchema,
  typeof timeOutputSchema
> = {
  type: 'time',
  label: 'Time',
  icon: Clock,
  category: 'input',
  schema: {
    config: timeConfigSchema,
    input: timeInputSchema,
    output: timeOutputSchema,
  },
  components: {
    Editor: TimeEditor,
    Viewer: TimeViewer,
    Properties: TimeProperties,
    Toolbar: TimeToolbar,
  },
};