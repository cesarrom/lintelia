import { CheckSquare } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { CheckboxToolbar } from './toolbar';
import { CheckboxCanvas } from './canvas';
import { CheckboxProperties } from './properties';

export const checkboxComponent: FormComponentDefinition = {
  type: 'checkbox',
  label: 'Checkbox',
  icon: CheckSquare,
  toolbar: CheckboxToolbar,
  canvas: CheckboxCanvas,
  properties: CheckboxProperties,
}; 