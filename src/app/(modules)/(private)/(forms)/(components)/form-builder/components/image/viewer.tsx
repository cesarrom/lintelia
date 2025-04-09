'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Upload, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../schemas';
import { ImageConfig } from './schema';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useController, ControllerFieldState, ControllerRenderProps } from 'react-hook-form';
import { putFile, downloadFile } from '@/app/(modules)/(private)/(shared)/(actions)/files';
import { v4 as uuid } from 'uuid';

// Define the image type
interface ImageItem {
  name: string;
  size: number;
  type: string;
  url: string;
  width: number;
  height: number;
  source: 'upload' | 'camera';
}

function ImageDisplayer({ key }: { key: string }) {
const [imageUrl, setImageUrl] = useState<string | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const fetchImage = async () => {
    if (!key) return;
    
    setLoading(true);
    try {
      const res = await downloadFile(key);
      if (res.Body) {
        setImageUrl(res.Body);
        setError(null);
      } else {
        setError('Failed to load image');
      }
    } catch (err) {
      setError('Error loading image');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  fetchImage();
}, [key]);

if (loading) return <div className="flex items-center justify-center p-4">Loading...</div>;
if (error) return <div className="text-red-500 p-2">{error}</div>;
if (!imageUrl) return null;

return (
  <div className="relative w-full">
    <img 
      src={imageUrl} 
      alt="Uploaded image" 
      className="w-full h-auto rounded-md object-contain"
    />
  </div>
);

}

export function ImageViewer({
  id,
  config,
  value,
  error: propError,
  onChange,
  onBlur,
  register,
  formState,
  control
}: ViewerProps<ImageConfig, string>) {
  const ref = useRef(uuid());
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [localError, setLocalError] = useState<string | undefined>(propError);

  // Check if we're using react-hook-form
  const isUsingReactHookForm = !!register && !!formState && !!control;

  // Use controller for react-hook-form if available
  const controllerResult = isUsingReactHookForm
    ? useController({
      name: config.propertyName,
      control: {
        ...control,
      },
      defaultValue: value || null,
      rules: {
        required: config.required ? 'This field is required' : false,
      },
    })
    : null;

  const field = controllerResult?.field || {} as Partial<ControllerRenderProps>;
  const fieldState = controllerResult?.fieldState || {} as Partial<ControllerFieldState>;

  // Get error message from react-hook-form or from props
  const error = isUsingReactHookForm && fieldState.error
    ? fieldState.error.message
    : (localError || propError);

  // Get current value
  const currentValue: string | null = isUsingReactHookForm && field.value
    ? field.value
    : value;

  // Handle file upload errors and validation
  const handleFileError = useCallback((errorMessage: string) => {
    if (isUsingReactHookForm && field.onChange) {
      field.onChange('');
      if (field.onBlur) field.onBlur();
    } else {
      onChange?.('' as any);
    }
    setLocalError(errorMessage);
  }, [field, isUsingReactHookForm, onChange]);

  // Update value and clear errors
  const updateFieldValue = useCallback((newValue: string| undefined | null) => {
    if (isUsingReactHookForm && field.onChange) {
      field.onChange(newValue);
      if (field.onBlur) field.onBlur();
    } else {
      onChange?.(newValue!);
    }
    setLocalError(undefined);
  }, [field, isUsingReactHookForm, onChange]);

  // Handle image file processing and validation
  const handleImageFile = useCallback(async (file: File) => {
    // Check file size
    if (file.size > config.maxSize) {
      handleFileError(`File size exceeds ${Math.round(config.maxSize / 1024 / 1024)}MB`);
      return;
    }

    const img = new Image();
    const ext = file.name.split('.').pop();
    const key = `${ref.current}.${ext}`;
    const url = await putFile(await file.text(), key);

    img.onload = async () => {
      URL.revokeObjectURL(url);

      // Validate image dimensions
      if (config.validation?.maxWidth && img.width > config.validation.maxWidth) {
        handleFileError(`Image width exceeds ${config.validation.maxWidth}px`);
        return;
      }

      if (config.validation?.maxHeight && img.height > config.validation.maxHeight) {
        handleFileError(`Image height exceeds ${config.validation.maxHeight}px`);
        return;
      }

      updateFieldValue(key);
    };

    img.src = url;
  }, [config, handleFileError, updateFieldValue]);

  // Camera control functions
  const stopCamera = useCallback(() => {
    if (!streamRef.current) return;

    streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;
      streamRef.current = stream;
    } catch (err) {
      console.error('Error accessing camera:', err);
    }
  }, []);

  // Event handlers
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    await handleImageFile(file);
  }, [handleImageFile]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await handleImageFile(file);
  }, [handleImageFile]);

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

  const removeImage = useCallback(() => {
    if (!currentValue) return;

    updateFieldValue(null);
  }, [currentValue, updateFieldValue]);

  // Side effects
  useEffect(() => {
    setLocalError(propError);
  }, [propError]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    setPreview(currentValue || null);
  }, [currentValue]);

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
          <ImageDisplayer key={preview} />
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
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer flex-col items-center">
                  <Upload className="mx-auto h-8 w-8 mb-2" />
                  <p>Upload Image</p>
                  <input
                    type="file"
                    id={id}
                    name={config.propertyName}
                    className="hidden"
                    accept={config.accept.join(',')}
                    onChange={handleFileChange}
                    onBlur={isUsingReactHookForm && field.onBlur ? field.onBlur : onBlur}
                    ref={isUsingReactHookForm && field.ref ? field.ref : undefined}
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
                {config.validation?.maxWidth && config.validation?.maxHeight
                  ? `Max dimensions: ${config.validation.maxWidth}x${config.validation.maxHeight}px`
                  : 'No size restrictions'}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Dialog open={showCamera} onOpenChange={handleCloseCameraDialog}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center space-y-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg"
            />
            <Button onClick={capturePhoto}>Capture</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 