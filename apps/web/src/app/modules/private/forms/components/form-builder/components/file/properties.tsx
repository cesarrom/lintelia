'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../schemas';
import { FileComponentSchema } from './schema';
import { FileConfig } from '@repo/lintelia/schemas';

export function FileProperties({ config, onChange }: PropertiesProps<FileConfig>) {
  const schemaRef = useRef(new FileComponentSchema(config.propertyName));

  useEffect(() => {
    schemaRef.current = new FileComponentSchema(config.propertyName);
    if (config.required) {
      schemaRef.current.setRequired(true);
    }
    if (config.validation?.minFiles) {
      schemaRef.current.setMinFiles(config.validation.minFiles);
    }
    if (config.validation?.maxFiles) {
      schemaRef.current.setMaxFiles(config.validation.maxFiles);
    }
    if (config.validation?.allowedTypes) {
      schemaRef.current.setAllowedTypes(config.validation.allowedTypes);
    }
  }, [config]);

  const handlePropertyNameChange = useCallback((value: string) => {
    onChange({
      ...config,
      propertyName: value,
    });
  }, [config, onChange]);

  const handleLabelChange = useCallback((value: string) => {
    onChange({
      ...config,
      label: value,
    });
  }, [config, onChange]);

  const handleDescriptionChange = useCallback((value: string) => {
    onChange({
      ...config,
      description: value,
    });
  }, [config, onChange]);

  const handleRequiredChange = useCallback((value: boolean) => {
    onChange({
      ...config,
      required: value,
    });
  }, [config, onChange]);

  const handleMultipleChange = useCallback((value: boolean) => {
    onChange({
      ...config,
      multiple: value,
    });
  }, [config, onChange]);

  const handleAcceptChange = useCallback((value: string) => {
    onChange({
      ...config,
      accept: value,
    });
  }, [config, onChange]);

  const handleMaxSizeChange = useCallback((value: string) => {
    const maxSize = value ? parseInt(value, 10) : undefined;
    onChange({
      ...config,
      maxSize,
    });
  }, [config, onChange]);

  const handleMinFilesChange = useCallback((value: string) => {
    const minFiles = value ? parseInt(value, 10) : undefined;
    onChange({
      ...config,
      validation: {
        ...config.validation,
        minFiles,
      },
    });
  }, [config, onChange]);

  const handleMaxFilesChange = useCallback((value: string) => {
    const maxFiles = value ? parseInt(value, 10) : undefined;
    onChange({
      ...config,
      validation: {
        ...config.validation,
        maxFiles,
      },
    });
  }, [config, onChange]);

  const handleAllowedTypesChange = useCallback((value: string) => {
    const types = value.split(',').map(t => t.trim()).filter(Boolean);
    onChange({
      ...config,
      validation: {
        ...config.validation,
        allowedTypes: types.length > 0 ? types : undefined,
      },
    });
  }, [config, onChange]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Property Name</Label>
        <Input
          value={config.propertyName}
          onChange={(e) => handlePropertyNameChange(e.target.value)}
          placeholder="Enter property name"
        />
      </div>
      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          value={config.label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="Enter label"
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={config.description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Enter description"
        />
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          checked={config.required}
          onCheckedChange={handleRequiredChange}
        />
        <Label>Required</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          checked={config.multiple}
          onCheckedChange={handleMultipleChange}
        />
        <Label>Allow Multiple Files</Label>
      </div>
      <div className="space-y-2">
        <Label>Accepted File Types</Label>
        <Input
          value={config.accept}
          onChange={(e) => handleAcceptChange(e.target.value)}
          placeholder="e.g., .pdf,.doc,image/*"
        />
      </div>
      <div className="space-y-2">
        <Label>Max File Size (bytes)</Label>
        <Input
          type="number"
          value={config.maxSize || ''}
          onChange={(e) => handleMaxSizeChange(e.target.value)}
          placeholder="Enter maximum file size"
        />
      </div>
      <div className="space-y-2">
        <Label>Minimum Files</Label>
        <Input
          type="number"
          value={config.validation?.minFiles || ''}
          onChange={(e) => handleMinFilesChange(e.target.value)}
          placeholder="Enter minimum number of files"
        />
      </div>
      <div className="space-y-2">
        <Label>Maximum Files</Label>
        <Input
          type="number"
          value={config.validation?.maxFiles || ''}
          onChange={(e) => handleMaxFilesChange(e.target.value)}
          placeholder="Enter maximum number of files"
        />
      </div>
      <div className="space-y-2">
        <Label>Allowed File Types</Label>
        <Input
          value={config.validation?.allowedTypes?.join(', ') || ''}
          onChange={(e) => handleAllowedTypesChange(e.target.value)}
          placeholder="e.g., image/jpeg, application/pdf"
        />
      </div>
    </div>
  );
}