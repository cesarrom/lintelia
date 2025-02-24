import { Palette } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { ColorToolbar } from './toolbar';
import { ColorCanvas } from './canvas';
import { ColorProperties } from './properties';

export const colorComponent: FormComponentDefinition = {
  type: 'color',
  label: 'Color Picker',
  icon: Palette,
  toolbar: ColorToolbar,
  canvas: ColorCanvas,
  properties: ColorProperties,
}; 