'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../schemas';
import { RangeComponentSchema } from './schema';
import { Slider } from '@/components/ui/slider';
import { RangeConfig } from '@repo/fintivio/schemas';

export function RangeProperties({ config, onChange }: PropertiesProps<RangeConfig>) {
  const schemaRef = useRef(new RangeComponentSchema(config.propertyName));

  useEffect(() => {
    schemaRef.current = new RangeComponentSchema(config.propertyName);
    if (config.required) {
      schemaRef.current.setRequired(true);
    }
    schemaRef.current.setMin(config.min);
    schemaRef.current.setMax(config.max);
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

  const handleMinChange = useCallback((value: string) => {
    const min = parseInt(value, 10);
    if (!isNaN(min)) {
      onChange({
        ...config,
        min,
        defaultValue: config.defaultValue < min ? min : config.defaultValue,
      });
    }
  }, [config, onChange]);

  const handleMaxChange = useCallback((value: string) => {
    const max = parseInt(value, 10);
    if (!isNaN(max)) {
      onChange({
        ...config,
        max,
        defaultValue: config.defaultValue > max ? max : config.defaultValue,
      });
    }
  }, [config, onChange]);

  const handleStepChange = useCallback((value: string) => {
    const step = parseInt(value, 10);
    if (!isNaN(step) && step > 0) {
      onChange({
        ...config,
        step,
      });
    }
  }, [config, onChange]);

  const handleDefaultValueChange = useCallback((value: string) => {
    const defaultValue = parseInt(value, 10);
    if (!isNaN(defaultValue)) {
      onChange({
        ...config,
        defaultValue: Math.min(Math.max(defaultValue, config.min), config.max),
      });
    }
  }, [config, onChange]);

  const handleShowValueChange = useCallback((value: boolean) => {
    onChange({
      ...config,
      showValue: value,
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
        <Label>Minimum Value</Label>
        <Input
          type="number"
          value={config.min}
          onChange={(e) => handleMinChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Maximum Value</Label>
        <Input
          type="number"
          value={config.max}
          onChange={(e) => handleMaxChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Step</Label>
        <Input
          type="number"
          min="1"
          value={config.step}
          onChange={(e) => handleStepChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Default Value: {config.defaultValue}</Label>
        <Slider
          value={[config.defaultValue ?? config.min]}
          min={config.min}
          max={config.max}
          step={config.step}
          onValueChange={(values) => handleDefaultValueChange(values[0].toString())}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          checked={config.showValue}
          onCheckedChange={handleShowValueChange}
        />
        <Label>Show Value</Label>
      </div>
    </div>
  );
} 