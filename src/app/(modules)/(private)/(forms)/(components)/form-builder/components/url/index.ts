import { Link } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { UrlToolbar } from './toolbar';
import { UrlCanvas } from './canvas';
import { UrlProperties } from './properties';

export const urlComponent: FormComponentDefinition = {
  type: 'url',
  label: 'URL',
  icon: Link,
  toolbar: UrlToolbar,
  canvas: UrlCanvas,
  properties: UrlProperties,
}; 