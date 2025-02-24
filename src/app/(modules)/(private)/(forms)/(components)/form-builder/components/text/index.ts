import { Type } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { TextToolbar } from './toolbar';
import { TextCanvas } from './canvas';
import { TextProperties } from './properties';

export const textComponent: FormComponentDefinition = {
  type: 'text',
  label: 'Text',
  icon: Type,
  toolbar: TextToolbar,
  canvas: TextCanvas,
  properties: TextProperties,
}; 