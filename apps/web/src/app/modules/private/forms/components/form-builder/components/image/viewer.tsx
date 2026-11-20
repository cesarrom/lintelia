'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ViewerProps } from '../../schemas';
import { ImageConfig } from '@repo/lintelia/schemas';
import { useController, ControllerFieldState, ControllerRenderProps } from 'react-hook-form';
import { v4 as uuid } from 'uuid';
import { PhotoField } from './imported-viewer';
import { useFilesGetObject, useFilesPutObject } from '@/lib/services/files.hooks';


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
  const { mutateAsync: putFile } = useFilesPutObject();
  const [file, setFile] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | undefined>(propError);
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

  const { data: infi, isLoading } = useFilesGetObject({
    objectId: currentValue,
  });

  const initialFile = isLoading ? "none" : infi;



  const realOnBlur = field?.onBlur || onBlur;

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
  const updateFieldValue = useCallback((newValue: string | undefined | null) => {
    if (isUsingReactHookForm && field.onChange) {
      field.onChange(newValue);
      if (field.onBlur) field.onBlur();
    } else {
      onChange?.(newValue!);
    }
    setLocalError(undefined);
  }, [field, isUsingReactHookForm, onChange]);

  const handleImageFile = useCallback(async (file: File) => {
    // Check file size
    if (file.size > config.maxSize) {
      handleFileError(`File size exceeds ${Math.round(config.maxSize / 1024 / 1024)}MB`);
      return;
    }

    const { key } = await putFile(file);
    updateFieldValue(key);
  }, [config, handleFileError, updateFieldValue]);

  if (!initialFile) return null;

  return (
    <div className="flex flex-col gap-y-2" id={id}>
      <PhotoField
        onChange={(f, value) => {
          if (value && value === file) return;

          if (f) {
            void handleImageFile(f);
          }
          if (value) {
            setFile(value);
          }
        }}
        value={file}
        onBlur={realOnBlur}
        name={config.propertyName}
        accept={config.accept.join(',')}
        required={config.required}
        title={config.label}
        initialFile={initialFile !== 'none' ? initialFile : null}
        disabled={false}
      />
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
}