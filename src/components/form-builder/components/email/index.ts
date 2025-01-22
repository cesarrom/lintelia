import { Mail } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { EmailToolbar } from './toolbar';
import { EmailCanvas } from './canvas';
import { EmailProperties } from './properties';

export const emailComponent: FormComponentDefinition = {
  type: 'email',
  label: 'Email',
  icon: Mail,
  toolbar: EmailToolbar,
  canvas: EmailCanvas,
  properties: EmailProperties,
}; 