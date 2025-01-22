import { FileUp } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { FileToolbar } from './toolbar';
import { FileCanvas } from './canvas';
import { FileProperties } from './properties';

export const fileComponent: FormComponentDefinition = {
  type: 'file',
  label: 'File Upload',
  icon: FileUp,
  toolbar: FileToolbar,
  canvas: FileCanvas,
  properties: FileProperties,
}; 