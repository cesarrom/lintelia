import { SeparatorHorizontal } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { SeparatorToolbar } from './toolbar';
import { SeparatorCanvas } from './canvas';
import { SeparatorProperties } from './properties';

export const separatorComponent: FormComponentDefinition = {
  type: 'separator',
  label: 'Page Separator',
  icon: SeparatorHorizontal,
  toolbar: SeparatorToolbar,
  canvas: SeparatorCanvas,
  properties: SeparatorProperties,
}; 