'use client';

import { Image as ImageIcon, Upload } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { cn } from '@/lib/utils';

interface ImageConfig {
  maxSize: number; // in MB
  allowedTypes: string[];
  aspectRatio?: number;
  maxWidth: number;
  maxHeight: number;
  showPreview: boolean;
  previewSize: 'sm' | 'md' | 'lg';
  resizeMode: 'cover' | 'contain' | 'fill';
  defaultImage?: string;
}

const defaultConfig: ImageConfig = {
  maxSize: 5,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
  maxWidth: 1920,
  maxHeight: 1080,
  showPreview: true,
  previewSize: 'md',
  resizeMode: 'cover'
};

const sizeMap = {
  sm: 'h-32',
  md: 'h-48',
  lg: 'h-64'
};

export function ImageCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  const config = field.config ? { ...defaultConfig, ...field.config as Partial<ImageConfig> } : defaultConfig;
  const imageUrl = field.defaultValue as string || config.defaultImage;

  return (
    <FieldWrapper
      field={field}
      icon={ImageIcon}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="space-y-2">
        {config.showPreview && imageUrl ? (
          <div
            className={cn(
              'relative w-full rounded-lg border bg-muted overflow-hidden',
              sizeMap[config.previewSize]
            )}
          >
            <img
              src={imageUrl}
              alt={field.label}
              className={cn(
                'w-full h-full',
                config.resizeMode === 'cover' && 'object-cover',
                config.resizeMode === 'contain' && 'object-contain',
                config.resizeMode === 'fill' && 'object-fill'
              )}
            />
          </div>
        ) : (
          <div
            className={cn(
              'flex flex-col items-center justify-center w-full rounded-lg border-2 border-dashed bg-muted/50 text-muted-foreground',
              sizeMap[config.previewSize]
            )}
          >
            <Upload className="h-8 w-8 mb-2" />
            <p className="text-sm">Upload an image</p>
            <p className="text-xs">
              {config.allowedTypes.join(', ')} up to {config.maxSize}MB
            </p>
          </div>
        )}
      </div>
    </FieldWrapper>
  );
} 