import { Radio as RadioIcon } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { RadioToolbar } from './toolbar';
import { RadioCanvas } from './canvas';
import { RadioProperties } from './properties';

export const radioComponent: FormComponentDefinition = {
  type: 'radio',
  label: 'Radio Group',
  icon: RadioIcon,
  toolbar: RadioToolbar,
  canvas: RadioCanvas,
  properties: RadioProperties,
}; 