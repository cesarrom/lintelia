'use client';

import { Camera, Image, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { imageConfigSchema } from './schema';
import { Separator } from '@/components/ui/separator';

export function ImageEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<typeof imageConfigSchema>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <Image className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <div
        className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed bg-muted p-4 text-sm text-muted-foreground"
      >
        <div className="text-center">
          {config.allowCamera ? (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <Upload className="mx-auto h-8 w-8 mb-2" />
                  <p>Upload Image</p>
                </div>
                <Separator orientation="vertical" className="h-16" />
                <div className="flex flex-col items-center">
                  <Camera className="mx-auto h-8 w-8 mb-2" />
                  <p>Take Photo</p>
                </div>
              </div>
              <p className="text-xs">
                {config.maxWidth && config.maxHeight
                  ? `Max dimensions: ${config.maxWidth}x${config.maxHeight}px`
                  : 'No size restrictions'}
              </p>
            </div>
          ) : (
            <>
              <Image className="mx-auto h-8 w-8 mb-2" />
              <p>{config.placeholder}</p>
              <p className="text-xs mt-1">
                {config.maxWidth && config.maxHeight
                  ? `Max dimensions: ${config.maxWidth}x${config.maxHeight}px`
                  : 'No size restrictions'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 