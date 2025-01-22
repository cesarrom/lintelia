import { CalendarClock } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { DateTimeToolbar } from './toolbar';
import { DateTimeCanvas } from './canvas';
import { DateTimeProperties } from './properties';

export const dateTimeComponent: FormComponentDefinition = {
  type: 'datetime',
  label: 'Date & Time',
  icon: CalendarClock,
  toolbar: DateTimeToolbar,
  canvas: DateTimeCanvas,
  properties: DateTimeProperties,
}; 