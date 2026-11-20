'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PropertiesProps } from '../../schemas';
import { PhoneComponentSchema } from './schema';
import { PhoneConfig } from '@repo/lintelia/schemas';

export function PhoneProperties({ config, onChange }: PropertiesProps<PhoneConfig>) {
  const schemaRef = useRef(new PhoneComponentSchema(config.propertyName));

  useEffect(() => {
    schemaRef.current = new PhoneComponentSchema(config.propertyName);
    if (config.required) {
      schemaRef.current.setRequired(true);
    }
    schemaRef.current.setPhoneValidation();
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

  const handleFormatChange = useCallback((value: 'international' | 'national') => {
    onChange({
      ...config,
      format: value,
    });
  }, [config, onChange]);

  const handleDefaultCountryChange = useCallback((value: string) => {
    onChange({
      ...config,
      defaultCountry: value,
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
        <Label>Format</Label>
        <Select
          value={config.format}
          onValueChange={(value) => handleFormatChange(value as 'international' | 'national')}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="international">International (+1 XXX-XXX-XXXX)</SelectItem>
            <SelectItem value="national">National ((XXX) XXX-XXXX)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Default Country</Label>
        <Input
          value={config.defaultCountry}
          onChange={(e) => handleDefaultCountryChange(e.target.value)}
          placeholder="Enter country code (e.g., US)"
        />
      </div>
    </div>
  );
} 