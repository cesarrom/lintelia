import { Calendar } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { DateToolbar } from './toolbar';
import { DateCanvas } from './canvas';
import { DateProperties } from './properties';

export const dateComponent: FormComponentDefinition = {
  type: 'date',
  label: 'Date Picker',
  icon: Calendar,
  toolbar: DateToolbar,
  canvas: DateCanvas,
  properties: DateProperties,
}; 