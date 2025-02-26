import { SlidersHorizontal } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { RangeEditor } from './editor';
import { RangeViewer } from './viewer';
import { RangeProperties } from './properties';
import { RangeToolbar } from './toolbar';
import { rangeConfigSchema, rangeInputSchema, rangeOutputSchema } from './schema';

export const rangeComponent: ComponentDefinition<
  typeof rangeConfigSchema,
  typeof rangeInputSchema,
  typeof rangeOutputSchema
> = {
  type: 'range',
  label: 'Range',
  category: 'input',
  icon: SlidersHorizontal,
  schema: {
    config: rangeConfigSchema,
    input: rangeInputSchema,
    output: rangeOutputSchema,
  },
  components: {
    Editor: RangeEditor,
    Viewer: RangeViewer,
    Properties: RangeProperties,
    Toolbar: RangeToolbar,
  },
}; 