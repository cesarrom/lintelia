import { Columns as ColumnsIcon } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { ColumnsToolbar } from './toolbar';
import { ColumnsCanvas } from './canvas';
import { ColumnsProperties } from './properties';

export const columnsComponent: FormComponentDefinition = {
  type: 'columns',
  label: 'Columns Layout',
  icon: ColumnsIcon,
  toolbar: ColumnsToolbar,
  canvas: ColumnsCanvas,
  properties: ColumnsProperties,
}; 