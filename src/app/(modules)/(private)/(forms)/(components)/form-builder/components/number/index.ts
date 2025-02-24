import { Hash } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { NumberToolbar } from './toolbar';
import { NumberCanvas } from './canvas';
import { NumberProperties } from './properties';

export const numberComponent: FormComponentDefinition = {
  type: 'number',
  label: 'Number',
  icon: Hash,
  toolbar: NumberToolbar,
  canvas: NumberCanvas,
  properties: NumberProperties,
}; 