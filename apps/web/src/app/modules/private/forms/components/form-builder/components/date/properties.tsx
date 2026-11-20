'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../schemas';
import { DateComponentSchema } from './schema';
import { DateConfig } from '@repo/lintelia/schemas';

export function DateProperties({ config, onChange }: PropertiesProps<DateConfig>) {
  const schemaRef = useRef(new DateComponentSchema(config.propertyName));

  useEffect(() => {
    schemaRef.current = new DateComponentSchema(config.propertyName);
    if (config.required) {
      schemaRef.current.setRequired(true);
    }
    if (config.validation?.minDate) {
      schemaRef.current.setMinDate(config.validation.minDate);
    }
    if (config.validation?.maxDate) {
      schemaRef.current.setMaxDate(config.validation.maxDate);
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

  const handleDefaultValueChange = useCallback((value: string) => {
    onChange({
      ...config,
      defaultValue: value || undefined,
    });
  }, [config, onChange]);

  const handleMinDateChange = useCallback((value: string) => {
    onChange({
      ...config,
      validation: {
        ...config.validation,
        minDate: value || undefined,
      },
    });
  }, [config, onChange]);

  const handleMaxDateChange = useCallback((value: string) => {
    onChange({
      ...config,
      validation: {
        ...config.validation,
        maxDate: value || undefined,
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
      <div className="space-y-2">
        <Label>Default Value</Label>
        <Input
          type="date"
          value={config.defaultValue || ''}
          onChange={(e) => handleDefaultValueChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Minimum Date</Label>
        <Input
          type="date"
          value={config.validation?.minDate || ''}
          onChange={(e) => handleMinDateChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Maximum Date</Label>
        <Input
          type="date"
          value={config.validation?.maxDate || ''}
          onChange={(e) => handleMaxDateChange(e.target.value)}
        />
      </div>
    </div>
  );
} 