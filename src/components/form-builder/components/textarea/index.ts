import { AlignLeft } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { TextareaToolbar } from './toolbar';
import { TextareaCanvas } from './canvas';
import { TextareaProperties } from './properties';

export const textareaComponent: FormComponentDefinition = {
  type: 'textarea',
  label: 'Text Area',
  icon: AlignLeft,
  toolbar: TextareaToolbar,
  canvas: TextareaCanvas,
  properties: TextareaProperties,
}; 