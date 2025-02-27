'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../schemas';
import { EmailComponentSchema, emailConfigSchema } from './schema';
import { z } from 'zod';

type EmailConfig = z.infer<typeof emailConfigSchema>;

export function EmailProperties({ config, onChange }: PropertiesProps<EmailConfig>) {
  const schemaRef = useRef(new EmailComponentSchema(config.propertyName));

  useEffect(() => {
    schemaRef.current = new EmailComponentSchema(config.propertyName);
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