'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../schemas';
import { NumberComponentSchema, numberConfigSchema } from './schema';
import { z } from 'zod';

type NumberConfig = z.infer<typeof numberConfigSchema>;

export function NumberProperties({ config, onChange }: PropertiesProps<NumberConfig>) {
  const schemaRef = useRef(new NumberComponentSchema(config.propertyName));

  useEffect(() => {
    schemaRef.current = new NumberComponentSchema(config.propertyName);
    if (config.required) {
      schemaRef.current.setRequired(true);
    }
    if (config.validation?.min !== undefined) {
      schemaRef.current.setMin(config.validation.min);
    }
    if (config.validation?.max !== undefined) {
      schemaRef.current.setMax(config.validation.max);
    }
    if (config.validation?.step !== undefined) {
      schemaRef.current.setStep(config.validation.step);
    }
    if (config.validation?.precision !== undefined) {
      schemaRef.current.setPrecision(config.validation.precision);
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

  const handleDefaultValueChange = useCallback((value: string) => {
    const defaultValue = value ? parseFloat(value) : undefined;
    onChange({
      ...config,
      defaultValue,
    });
  }, [config, onChange]);

  const handleMinChange = useCallback((value: string) => {
    const min = value ? parseFloat(value) : undefined;
    onChange({
      ...config,
      validation: {
        ...config.validation,
        min,
      },
    });
  }, [config, onChange]);

  const handleMaxChange = useCallback((value: string) => {
    const max = value ? parseFloat(value) : undefined;
    onChange({
      ...config,
      validation: {
        ...config.validation,
        max,
      },
    });
  }, [config, onChange]);

  const handleStepChange = useCallback((value: string) => {
    const step = value ? parseFloat(value) : undefined;
    onChange({
      ...config,
      validation: {
        ...config.validation,
        step,
      },
    });
  }, [config, onChange]);

  const handlePrecisionChange = useCallback((value: string) => {
    const precision = value ? parseInt(value, 10) : undefined;
    onChange({
      ...config,
      validation: {
        ...config.validation,
        precision,
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
        <Label>Default Value</Label>
        <Input
          type="number"
          value={config.defaultValue !== undefined ? config.defaultValue : ''}
          onChange={(e) => handleDefaultValueChange(e.target.value)}
          placeholder="Enter default value"
        />
      </div>
      <div className="space-y-2">
        <Label>Minimum Value</Label>
        <Input
          type="number"
          value={config.validation?.min !== undefined ? config.validation.min : ''}
          onChange={(e) => handleMinChange(e.target.value)}
          placeholder="Enter minimum value"
        />
      </div>
      <div className="space-y-2">
        <Label>Maximum Value</Label>
        <Input
          type="number"
          value={config.validation?.max !== undefined ? config.validation.max : ''}
          onChange={(e) => handleMaxChange(e.target.value)}
          placeholder="Enter maximum value"
        />
      </div>
      <div className="space-y-2">
        <Label>Step</Label>
        <Input
          type="number"
          value={config.validation?.step !== undefined ? config.validation.step : ''}
          onChange={(e) => handleStepChange(e.target.value)}
          placeholder="Enter step value"
          min={0.001}
          step={0.001}
        />
      </div>
      <div className="space-y-2">
        <Label>Precision (decimal places)</Label>
        <Input
          type="number"
          value={config.validation?.precision !== undefined ? config.validation.precision : ''}
          onChange={(e) => handlePrecisionChange(e.target.value)}
          placeholder="Enter precision"
          min={0}
          max={10}
          step={1}
        />
      </div>
    </div>
  );
} 