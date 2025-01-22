import { Phone } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { PhoneToolbar } from './toolbar';
import { PhoneCanvas } from './canvas';
import { PhoneProperties } from './properties';

export const phoneComponent: FormComponentDefinition = {
  type: 'phone',
  label: 'Phone Number',
  icon: Phone,
  toolbar: PhoneToolbar,
  canvas: PhoneCanvas,
  properties: PhoneProperties,
}; 