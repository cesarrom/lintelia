import { Star } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { RatingToolbar } from './toolbar';
import { RatingCanvas } from './canvas';
import { RatingProperties } from './properties';

export const ratingComponent: FormComponentDefinition = {
  type: 'rating',
  label: 'Rating',
  icon: Star,
  toolbar: RatingToolbar,
  canvas: RatingCanvas,
  properties: RatingProperties,
}; 