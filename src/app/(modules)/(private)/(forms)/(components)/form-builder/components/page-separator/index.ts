import { SplitSquareHorizontal } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { PageSeparatorToolbar } from './toolbar';
import { PageSeparatorCanvas } from './canvas';
import { PageSeparatorProperties } from './properties';

export const pageSeparatorComponent: FormComponentDefinition = {
  type: 'page-separator',
  label: 'Page Break',
  icon: SplitSquareHorizontal,
  toolbar: PageSeparatorToolbar,
  canvas: PageSeparatorCanvas,
  properties: PageSeparatorProperties,
}; 