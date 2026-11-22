'use client';

import { useCallback, useState } from 'react';
import { FileUp, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../schemas';
import { FileConfig } from '@repo/lintelia/schemas';
import { useController, ControllerFieldState, ControllerRenderProps } from 'react-hook-form';

// Define the file type
interface FileItem {
  name: string;
  size: number;
  type: string;
  url: string;
}

export function FileViewer({
  id,
  config,
  value = [],
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<FileConfig, FileItem[]>) {
  const [isDragging, setIsDragging] = useState(false);

  // Check if we're using react-hook-form
  const isUsingReactHookForm = !!register && !!formState && !!control;
  
  // Use controller for react-hook-form if available
  const controllerResult = isUsingReactHookForm 
    ? useController({
        name: config.propertyName,
        control,
        defaultValue: value || [],
        rules: {
          required: config.required ? 'This field is required' : false,
          validate: {
            fileCount: (files) => {
              if (!config.required && (!files || files.length === 0)) return true;
              if (config.required && (!files || files.length === 0)) return 'Please select a file';
              if (config.validation?.maxFiles && files.length > config.validation.maxFiles) 
                return `Maximum ${config.validation.maxFiles} files allowed`;
              return true;
            }
          }
        }
      })
    : null;
  
  const field = controllerResult?.field || {} as Partial<ControllerRenderProps>;
  const fieldState = controllerResult?.fieldState || {} as Partial<ControllerFieldState>;

  // Get error message from react-hook-form or from props
  const errorMessage = isUsingReactHookForm && fieldState.error
    ? fieldState.error.message 
    : error;

  // Get current files
  const files = isUsingReactHookForm && Array.isArray(field.value) 
    ? field.value 
    : (value as FileItem[]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  }, []);

  const handleFiles = (files: File[]) => {
    // Filter files based on accept
    const acceptedTypes = config.accept.split(',').map(t => t.trim());
    const filteredFiles = files.filter(file => {
      if (config.accept === '*/*') return true;
      return acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return file.name.endsWith(type);
        }
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.slice(0, -2));
        }
        return file.type === type;
      });
    });

    // Filter files based on size
    const validFiles = filteredFiles.filter(
      file => !config.maxSize || file.size <= config.maxSize
    );

    // Check max files limit
    const currentFiles = isUsingReactHookForm && Array.isArray(field.value) 
      ? field.value 
      : (value as FileItem[]);
    const totalFiles = currentFiles.length + validFiles.length;
    if (config.validation?.maxFiles && totalFiles > config.validation.maxFiles) {
      // TODO: Show error message
      return;
    }

    // Convert files to our format
    const newFiles = validFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    }));

    // Update value
    const updatedFiles = config.multiple 
      ? [...currentFiles, ...newFiles] 
      : newFiles;

    if (isUsingReactHookForm && field.onChange) {
      field.onChange(updatedFiles);
      if (field.onBlur) field.onBlur();
    } else if (onChange) {
      onChange(updatedFiles);
      if (onBlur) onBlur();
    }
  };

  const removeFile = (index: number) => {
    const currentFiles = isUsingReactHookForm && Array.isArray(field.value) 
      ? [...field.value] 
      : [...(value as FileItem[])];
    
    URL.revokeObjectURL(currentFiles[index].url);
    currentFiles.splice(index, 1);
    
    if (isUsingReactHookForm && field.onChange) {
      field.onChange(currentFiles);
      if (field.onBlur) field.onBlur();
    } else if (onChange) {
      onChange(currentFiles);
      if (onBlur) onBlur();
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

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex h-32 items-center justify-center rounded-lg border-2 border-dashed p-4 text-sm text-muted-foreground transition-colors',
          isDragging && 'border-primary bg-primary/10',
          errorMessage && 'border-destructive'
        )}
      >
        <div className="text-center">
          <FileUp className="mx-auto h-8 w-8 mb-2" />
          <p>Upload Files</p>
          <p className="text-xs mt-1">
            {config.multiple ? 'Drop files here or click to select' : 'Drop a file here or click to select'}
          </p>
          <input
            id={id}
            name={config.propertyName}
            type="file"
            accept={config.accept}
            multiple={config.multiple}
            onChange={handleFileChange}
            onBlur={isUsingReactHookForm && field.onBlur ? field.onBlur : onBlur}
            className="hidden"
            ref={isUsingReactHookForm && field.ref ? field.ref : undefined}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => document.getElementById(id)?.click()}
          >
            Select File{config.multiple && 's'}
          </Button>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={file.url}
              className="flex items-center justify-between rounded-lg border p-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <FileUp className="h-4 w-4" />
                <span>{file.name}</span>
                <span className="text-muted-foreground">
                  ({Math.round(file.size / 1024)}KB)
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
} 