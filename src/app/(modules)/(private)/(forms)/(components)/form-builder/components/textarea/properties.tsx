'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../schemas';
import { TextareaComponentSchema, textareaConfigSchema } from './schema';
import { z } from 'zod';

type TextareaConfig = z.infer<typeof textareaConfigSchema>;

export function TextareaProperties({ config, onChange }: PropertiesProps<TextareaConfig>) {
  const schemaRef = useRef(new TextareaComponentSchema(config.propertyName));

  useEffect(() => {
    schemaRef.current = new TextareaComponentSchema(config.propertyName);
    if (config.required) {
      schemaRef.current.setRequired(true);
    }
    if (config.validation?.minLength) {
      schemaRef.current.setMinLength(config.validation.minLength);
    }
    if (config.validation?.maxLength) {
      schemaRef.current.setMaxLength(config.validation.maxLength);
    }
    if (config.validation?.pattern) {
      schemaRef.current.setPattern(config.validation.pattern);
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

  const handlePlaceholderChange = useCallback((value: string) => {
    onChange({
      ...config,
      placeholder: value,
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

  const handleRowsChange = useCallback((value: string) => {
    const rows = value ? parseInt(value, 10) : 4;
    onChange({
      ...config,
      rows: rows < 2 ? 2 : rows,
    });
  }, [config, onChange]);

  const handleMinLengthChange = useCallback((value: string) => {
    const minLength = value ? parseInt(value, 10) : undefined;
    onChange({
      ...config,
      validation: {
        ...config.validation,
        minLength,
      },
    });
  }, [config, onChange]);

  const handleMaxLengthChange = useCallback((value: string) => {
    const maxLength = value ? parseInt(value, 10) : undefined;
    onChange({
      ...config,
      validation: {
        ...config.validation,
        maxLength,
      },
    });
  }, [config, onChange]);

  const handlePatternChange = useCallback((value: string) => {
    onChange({
      ...config,
      validation: {
        ...config.validation,
        pattern: value || undefined,
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
        <Label>Placeholder</Label>
        <Input
          value={config.placeholder}
          onChange={(e) => handlePlaceholderChange(e.target.value)}
          placeholder="Enter placeholder"
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
      <div className="space-y-2">
        <Label>Rows</Label>
        <Input
          type="number"
          value={config.rows}
          onChange={(e) => handleRowsChange(e.target.value)}
          min={2}
          placeholder="Enter number of rows"
        />
      </div>
      <div className="space-y-2">
        <Label>Minimum Length</Label>
        <Input
          type="number"
          value={config.validation?.minLength || ''}
          onChange={(e) => handleMinLengthChange(e.target.value)}
          placeholder="Enter minimum length"
        />
      </div>
      <div className="space-y-2">
        <Label>Maximum Length</Label>
        <Input
          type="number"
          value={config.validation?.maxLength || ''}
          onChange={(e) => handleMaxLengthChange(e.target.value)}
          placeholder="Enter maximum length"
        />
      </div>
      <div className="space-y-2">
        <Label>Pattern (Regex)</Label>
        <Input
          value={config.validation?.pattern || ''}
          onChange={(e) => handlePatternChange(e.target.value)}
          placeholder="Enter regex pattern"
        />
      </div>
    </div>
  );
}