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
import { ColorComponentSchema } from './schema';
import { ColorConfig } from '@repo/fintivio/schemas';


export function ColorProperties({ config, onChange }: PropertiesProps<ColorConfig>) {
  const schemaRef = useRef(new ColorComponentSchema(config.propertyName));

  useEffect(() => {
    schemaRef.current = new ColorComponentSchema(config.propertyName);
    if (config.required) {
      schemaRef.current.setRequired(true);
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
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      onChange({
        ...config,
        defaultValue: value,
      });
    }
  }, [config, onChange]);

  const handleFormatChange = useCallback((value: 'hex' | 'rgb') => {
    onChange({
      ...config,
      format: value,
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
        <Label>Default Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={config.defaultValue || '#000000'}
            onChange={(e) => handleDefaultValueChange(e.target.value)}
            className="h-10 w-20 cursor-pointer"
          />
          <Input
            type="text"
            value={config.defaultValue || '#000000'}
            onChange={(e) => handleDefaultValueChange(e.target.value)}
            placeholder="#000000"
            className="flex-1"
          />
        </div>
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
            <SelectItem value="hex">Hex (#RRGGBB)</SelectItem>
            <SelectItem value="rgb">RGB (r,g,b)</SelectItem>
          </SelectContent>
        </Select>
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