import { Image } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { ImageToolbar } from './toolbar';
import { ImageCanvas } from './canvas';
import { ImageProperties } from './properties';

export const imageComponent: FormComponentDefinition = {
  type: 'image',
  label: 'Image Upload',
  icon: Image,
  toolbar: ImageToolbar,
  canvas: ImageCanvas,
  properties: ImageProperties,
}; 