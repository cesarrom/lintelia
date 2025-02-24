import { LayoutGrid } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { SectionToolbar } from './toolbar';
import { SectionCanvas } from './canvas';
import { SectionProperties } from './properties';

export const sectionComponent: FormComponentDefinition = {
  type: 'section',
  label: 'Section',
  icon: LayoutGrid,
  toolbar: SectionToolbar,
  canvas: SectionCanvas,
  properties: SectionProperties,
}; 