'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PropertiesProps } from '../../schemas';
import { DatetimeComponentSchema } from './schema';
import { DatetimeConfig } from '@repo/fintivio/schemas';

export function DatetimeProperties({ config, onChange }: PropertiesProps<DatetimeConfig>) {
  const schemaRef = useRef(new DatetimeComponentSchema(config.propertyName));

  useEffect(() => {
    schemaRef.current = new DatetimeComponentSchema(config.propertyName);
    if (config.required) {
      schemaRef.current.setRequired(true);
    }
    if (config.validation?.min) {
      schemaRef.current.setMinDate(config.validation.min);
    }
    if (config.validation?.max) {
      schemaRef.current.setMaxDate(config.validation.max);
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

  const handlePlaceholderChange = useCallback((value: string) => {
    onChange({
      ...config,
      placeholder: value,
    });
  }, [config, onChange]);

  const handleRequiredChange = useCallback((value: boolean) => {
    onChange({
      ...config,
      required: value,
    });
  }, [config, onChange]);

  const handleFormatChange = useCallback((value: 'date' | 'datetime' | 'time') => {
    onChange({
      ...config,
      format: value,
    });
  }, [config, onChange]);

  const handleMinDateChange = useCallback((value: string) => {
    onChange({
      ...config,
      validation: {
        ...config.validation,
        min: value || undefined,
      },
    });
  }, [config, onChange]);

  const handleMaxDateChange = useCallback((value: string) => {
    onChange({
      ...config,
      validation: {
        ...config.validation,
        max: value || undefined,
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
      <div className="space-y-2">
        <Label>Placeholder</Label>
        <Input
          value={config.placeholder}
          onChange={(e) => handlePlaceholderChange(e.target.value)}
          placeholder="Enter placeholder"
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
        <Label>Format</Label>
        <Select
          value={config.format}
          onValueChange={handleFormatChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="datetime">Date & Time</SelectItem>
            <SelectItem value="time">Time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Minimum Date</Label>
        <Input
          type="datetime-local"
          value={config.validation?.min || ''}
          onChange={(e) => handleMinDateChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Maximum Date</Label>
        <Input
          type="datetime-local"
          value={config.validation?.max || ''}
          onChange={(e) => handleMaxDateChange(e.target.value)}
        />
      </div>
    </div>
  );
} 