import { Clock } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { TimeToolbar } from './toolbar';
import { TimeCanvas } from './canvas';
import { TimeProperties } from './properties';

export const timeComponent: FormComponentDefinition = {
  type: 'time',
  label: 'Time Picker',
  icon: Clock,
  toolbar: TimeToolbar,
  canvas: TimeCanvas,
  properties: TimeProperties,
}; 