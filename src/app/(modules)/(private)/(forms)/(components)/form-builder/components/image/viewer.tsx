'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Upload, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../types';
import { imageConfigSchema, imageInputSchema, imageOutputSchema } from './schema';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function ImageViewer({
  id,
  config,
  value,
  error: propError,
  onChange,
  onBlur,
}: ViewerProps<typeof imageConfigSchema, typeof imageInputSchema, typeof imageOutputSchema>) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | undefined>(propError);

  useEffect(() => {
    setError(propError);
  }, [propError]);

  useEffect(() => {
    if (value?.url) {
      setPreview(value.url);
    } else {
      setPreview(null);
    }
  }, [value]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: config.cameraOptions.facingMode,
          width: { ideal: config.cameraOptions.idealResolution.width },
          height: { ideal: config.cameraOptions.idealResolution.height }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
    }
  }, [config.cameraOptions]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);

      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/')) return;

      await handleImageFile(file);
    },
    [config]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      await handleImageFile(file);
    },
    [config]
  );

  const handleImageFile = useCallback(async (file: File) => {
    if (file.size > config.maxSize) {
      onChange?.(undefined as any);
      setError(`File size exceeds ${config.maxSize} bytes`);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      if (config.maxWidth && img.width > config.maxWidth) {
        onChange?.(undefined as any);
        setError(`Image width exceeds ${config.maxWidth}px`);
        return;
      }

      if (config.maxHeight && img.height > config.maxHeight) {
        onChange?.(undefined as any);
        setError(`Image height exceeds ${config.maxHeight}px`);
        return;
      }

      onChange?.({
        name: file.name,
        size: file.size,
        type: file.type,
        url,
        width: img.width,
        height: img.height,
        source: 'upload'
      });
      setError(undefined);
    };

    img.src = url;
  }, [config, onChange]);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    
    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', 0.8);
    });

    if (!blob) return;

    const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
    await handleImageFile(file);
    setShowCamera(false);
    stopCamera();
  }, [handleImageFile, stopCamera]);

  const handleCameraClick = useCallback(() => {
    setShowCamera(true);
    startCamera();
  }, [startCamera]);

  const handleCloseCameraDialog = useCallback(() => {
    setShowCamera(false);
    stopCamera();
  }, [stopCamera]);

  const removeImage = () => {
    if (value?.url) {
      URL.revokeObjectURL(value.url);
      onChange?.(undefined as any); // Type assertion needed as the schema doesn't properly handle optional values
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}

      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="max-h-[200px] rounded-lg object-contain"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            onClick={removeImage}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            'flex min-h-[150px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed bg-muted p-4 transition-colors',
            dragOver && 'border-primary',
            error && 'border-destructive'
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="text-center">
            {config.allowCamera ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer flex-col items-center">
                    <Upload className="mx-auto h-8 w-8 mb-2" />
                    <p>Upload Image</p>
                    <input
                      type="file"
                      id={id}
                      className="hidden"
                      accept={config.accept}
                      onChange={handleFileChange}
                    />
                  </label>
                  <Separator orientation="vertical" className="h-16" />
                  <div
                    className="flex cursor-pointer flex-col items-center"
                    onClick={handleCameraClick}
                  >
                    <Camera className="mx-auto h-8 w-8 mb-2" />
                    <p>Take Photo</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {config.maxWidth && config.maxHeight
                    ? `Max dimensions: ${config.maxWidth}x${config.maxHeight}px`
                    : 'No size restrictions'}
                </p>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center" htmlFor={id}>
                <ImageIcon className="mx-auto h-8 w-8 mb-2" />
                <p>{config.placeholder}</p>
                <p className="text-xs mt-1 text-muted-foreground">
                  {config.maxWidth && config.maxHeight
                    ? `Max dimensions: ${config.maxWidth}x${config.maxHeight}px`
                    : 'No size restrictions'}
                </p>
                <input
                  type="file"
                  id={id}
                  className="hidden"
                  accept={config.accept}
                  onChange={handleFileChange}
                />
              </label>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Dialog open={showCamera} onOpenChange={handleCloseCameraDialog}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center gap-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg"
            />
            <div className="flex justify-center gap-2">
              <Button onClick={capturePhoto}>
                Take Photo
              </Button>
              <Button variant="outline" onClick={handleCloseCameraDialog}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 