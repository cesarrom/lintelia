import { ListChecks } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { MultiselectToolbar } from './toolbar';
import { MultiselectCanvas } from './canvas';
import { MultiselectProperties } from './properties';

export const multiselectComponent: FormComponentDefinition = {
  type: 'multiselect',
  label: 'Multi Select',
  icon: ListChecks,
  toolbar: MultiselectToolbar,
  canvas: MultiselectCanvas,
  properties: MultiselectProperties,
}; 