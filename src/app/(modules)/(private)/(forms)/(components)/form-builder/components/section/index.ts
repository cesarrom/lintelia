import { LayoutPanelTop } from 'lucide-react';
import { ComponentDefinition } from '../../types';
import { sectionConfigSchema, sectionInputSchema, sectionOutputSchema } from './schema';
import { SectionEditor } from './editor';
import { SectionViewer } from './viewer';
import { SectionProperties } from './properties';
import { SectionToolbar } from './toolbar';

export const sectionComponent: ComponentDefinition<
  typeof sectionConfigSchema,
  typeof sectionInputSchema,
  typeof sectionOutputSchema
> = {
  type: 'section',
  label: 'Section',
  category: 'layout',
  icon: LayoutPanelTop,
  schema: {
    config: sectionConfigSchema,
    input: sectionInputSchema,
    output: sectionOutputSchema,
  },
  components: {
    Editor: SectionEditor,
    Viewer: SectionViewer,
    Properties: SectionProperties,
    Toolbar: SectionToolbar,
  },
}; 