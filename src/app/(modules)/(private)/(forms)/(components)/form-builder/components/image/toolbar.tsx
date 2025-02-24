'use client';

import { Image } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

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

export function ImageToolbar() {
  return (
    <ToolbarButton
      type="image"
      label="Image Upload"
      icon={Image}
      config={defaultConfig}
    />
  );
} 