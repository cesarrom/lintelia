'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../schemas';
import { RichtextComponentSchema, richtextConfigSchema, RichtextConfig } from './schema';
import { z } from 'zod';
import { Separator } from '@/components/ui/separator';

export function RichtextProperties({ config, onChange }: PropertiesProps<RichtextConfig>) {
  const schemaRef = useRef(new RichtextComponentSchema(config.propertyName));

  useEffect(() => {
    schemaRef.current = new RichtextComponentSchema(config.propertyName);
    if (config.required) {
      schemaRef.current.setRequired(true);
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

  const handleEnableVariablesChange = useCallback((value: boolean) => {
    onChange({
      ...config,
      enableVariables: value,
    });
  }, [config, onChange]);

  const handleEnableFieldReferencesChange = useCallback((value: boolean) => {
    onChange({
      ...config,
      enableFieldReferences: value,
    });
  }, [config, onChange]);

  const handleEnableSystemVariablesChange = useCallback((value: boolean) => {
    onChange({
      ...config,
      enableSystemVariables: value,
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

      <Separator className="my-4" />
      
      <div className="space-y-4">
        <h3 className="text-sm font-medium">References</h3>
        
        <div className="flex items-center space-x-2">
          <Switch
            checked={config.enableVariables}
            onCheckedChange={handleEnableVariablesChange}
          />
          <Label>Enable Form Variables</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            checked={config.enableFieldReferences}
            onCheckedChange={handleEnableFieldReferencesChange}
          />
          <Label>Enable Form Field References</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            checked={config.enableSystemVariables}
            onCheckedChange={handleEnableSystemVariablesChange}
          />
          <Label>Enable System Variables</Label>
        </div>
      </div>
    </div>
  );
} 