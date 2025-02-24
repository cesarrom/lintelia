import { List } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { SelectToolbar } from './toolbar';
import { SelectCanvas } from './canvas';
import { SelectProperties } from './properties';

export const selectComponent: FormComponentDefinition = {
  type: 'select',
  label: 'Select',
  icon: List,
  toolbar: SelectToolbar,
  canvas: SelectCanvas,
  properties: SelectProperties,
}; 