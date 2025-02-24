'use client';

import { Star } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

interface RatingConfig {
  maxRating: number;
  showLabels: boolean;
  labels: string[];
  icon: 'star' | 'heart' | 'thumbsUp';
  size: 'sm' | 'md' | 'lg';
  showValue: boolean;
}

const defaultConfig: RatingConfig = {
  maxRating: 5,
  showLabels: true,
  labels: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'],
  icon: 'star',
  size: 'md',
  showValue: true
};

export function RatingToolbar() {
  return (
    <ToolbarButton
      type="rating"
      label="Rating"
      icon={Star}
      config={defaultConfig}
    />
  );
} 