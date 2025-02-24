'use client';

import { Star, Heart, ThumbsUp } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { cn } from '@/lib/utils';

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

const iconMap = {
  star: Star,
  heart: Heart,
  thumbsUp: ThumbsUp
};

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8'
};

export function RatingCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  const config = field.config ? { ...defaultConfig, ...field.config as Partial<RatingConfig> } : defaultConfig;
  const value = field.defaultValue ? Number(field.defaultValue) : 0;
  const Icon = iconMap[config.icon];
  const iconSize = sizeMap[config.size];

  return (
    <FieldWrapper
      field={field}
      icon={Star}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="space-y-2">
        <div className="flex gap-1">
          {Array.from({ length: config.maxRating }).map((_, i) => {
            const isActive = i < value;
            return (
              <Icon
                key={i}
                className={cn(
                  iconSize,
                  'cursor-default',
                  isActive ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'
                )}
              />
            );
          })}
        </div>
        {config.showLabels && value > 0 && (
          <p className="text-sm text-muted-foreground">
            {config.labels[value - 1]}
          </p>
        )}
        {config.showValue && value > 0 && (
          <p className="text-sm text-muted-foreground">
            {value} out of {config.maxRating}
          </p>
        )}
      </div>
    </FieldWrapper>
  );
} 