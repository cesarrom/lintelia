'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../schemas';
import { TimeComponentSchema } from './schema';
import { TimeConfig } from '@repo/lintelia/schemas';

export function TimeProperties({ config, onChange }: PropertiesProps<TimeConfig>) {
  const schemaRef = useRef(new TimeComponentSchema(config.propertyName));

  useEffect(() => {
    schemaRef.current = new TimeComponentSchema(config.propertyName);
    if (config.required) {
      schemaRef.current.setRequired(true);
    }
    if (config.min) {
      schemaRef.current.setMinTime(config.min);
    }
    if (config.max) {
      schemaRef.current.setMaxTime(config.max);
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

  const handleMinChange = useCallback((value: string) => {
    onChange({
      ...config,
      min: value || undefined,
    });
  }, [config, onChange]);

  const handleMaxChange = useCallback((value: string) => {
    onChange({
      ...config,
      max: value || undefined,
    });
  }, [config, onChange]);

  const handleStepChange = useCallback((value: string) => {
    // Parse the input value to a number, or use 60 as default
    const step = value ? parseInt(value, 10) : 60;
    onChange({
      ...config,
      step,
    });
  }, [config, onChange]);

  const handleRequiredChange = useCallback((value: boolean) => {
    onChange({
      ...config,
      required: value,
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
        <Label>Minimum Time (HH:mm)</Label>
        <Input
          type="time"
          value={config.min || ''}
          onChange={(e) => handleMinChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Maximum Time (HH:mm)</Label>
        <Input
          type="time"
          value={config.max || ''}
          onChange={(e) => handleMaxChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Time Step (seconds)</Label>
        <Input
          type="number"
          value={config.step}
          onChange={(e) => handleStepChange(e.target.value)}
          min={1}
        />
      </div>
    </div>
  );
} 