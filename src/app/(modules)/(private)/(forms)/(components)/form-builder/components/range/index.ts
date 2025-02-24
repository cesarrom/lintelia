import { SlidersHorizontal } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { RangeToolbar } from './toolbar';
import { RangeCanvas } from './canvas';
import { RangeProperties } from './properties';

export const rangeComponent: FormComponentDefinition = {
  type: 'range',
  label: 'Range Slider',
  icon: SlidersHorizontal,
  toolbar: RangeToolbar,
  canvas: RangeCanvas,
  properties: RangeProperties,
}; 