import { Palette } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { colorConfigSchema, colorInputSchema, colorOutputSchema } from './schema';
import { ColorEditor } from './editor';
import { ColorViewer } from './viewer';
import { ColorProperties } from './properties';
import { ColorToolbar } from './toolbar';

export const colorComponent: ComponentDefinition<
  typeof colorConfigSchema,
  typeof colorInputSchema,
  typeof colorOutputSchema
> = {
  type: 'color',
  label: 'Color',
  icon: Palette,
  category: 'input',
  schema: {
    config: colorConfigSchema,
    input: colorInputSchema,
    output: colorOutputSchema,
  },
  components: {
    Editor: ColorEditor,
    Viewer: ColorViewer,
    Properties: ColorProperties,
    Toolbar: ColorToolbar,
  },
}; 