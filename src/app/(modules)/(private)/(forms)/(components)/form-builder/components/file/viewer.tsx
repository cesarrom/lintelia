'use client';

import { useCallback, useState } from 'react';
import { FileUp, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../types';
import { fileConfigSchema, fileInputSchema, fileOutputSchema } from './schema';

export function FileViewer({
  id,
  config,
  value = [],
  onChange,
  onBlur,
  error,
}: ViewerProps<typeof fileConfigSchema, typeof fileInputSchema, typeof fileOutputSchema>) {
  const [isDragging, setIsDragging] = useState(false);

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
      file => file.size >= config.minSize && file.size <= config.maxSize
    );

    // Check max files limit
    const totalFiles = value.length + validFiles.length;
    if (totalFiles > config.maxFiles) {
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
    if (config.allowMultiple) {
      onChange?.([...value, ...newFiles]);
    } else {
      onChange?.(newFiles);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...value];
    URL.revokeObjectURL(newFiles[index].url);
    newFiles.splice(index, 1);
    onChange?.(newFiles);
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
          error && 'border-destructive'
        )}
      >
        <div className="text-center">
          <FileUp className="mx-auto h-8 w-8 mb-2" />
          <p>{config.placeholder}</p>
          <p className="text-xs mt-1">
            {config.allowMultiple ? 'Drop files here or click to select' : 'Drop a file here or click to select'}
          </p>
          <input
            id={id}
            type="file"
            accept={config.accept}
            multiple={config.allowMultiple}
            onChange={handleFileChange}
            onBlur={onBlur}
            className="hidden"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => document.getElementById(id)?.click()}
          >
            Select File{config.allowMultiple && 's'}
          </Button>
        </div>
      </div>

      {/* File List */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((file, index) => (
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

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 