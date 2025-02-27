'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../schemas';
import { RatingComponentSchema, ratingConfigSchema, RatingConfig } from './schema';
import { Slider } from '@/components/ui/slider';

export function RatingProperties({ config, onChange }: PropertiesProps<RatingConfig>) {
  const schemaRef = useRef(new RatingComponentSchema(config.propertyName));

  useEffect(() => {
    schemaRef.current = new RatingComponentSchema(config.propertyName);
    if (config.required) {
      schemaRef.current.setRequired(true);
    }
    schemaRef.current.setMaxRating(config.maxRating);
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

  const handleMaxRatingChange = useCallback((value: number[]) => {
    onChange({
      ...config,
      maxRating: value[0],
    });
  }, [config, onChange]);

  const handleShowLabelsChange = useCallback((value: boolean) => {
    onChange({
      ...config,
      showLabels: value,
    });
  }, [config, onChange]);

  const handleLowLabelChange = useCallback((value: string) => {
    onChange({
      ...config,
      lowLabel: value,
    });
  }, [config, onChange]);

  const handleHighLabelChange = useCallback((value: string) => {
    onChange({
      ...config,
      highLabel: value,
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
        <Label>Maximum Rating</Label>
        <Slider
          value={[config.maxRating]}
          onValueChange={handleMaxRatingChange}
          min={1}
          max={10}
          step={1}
          className="py-2"
        />
        <p className="text-sm text-muted-foreground text-right">{config.maxRating} stars</p>
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          checked={config.required}
          onCheckedChange={handleRequiredChange}
        />
        <Label>Required</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          checked={config.showLabels}
          onCheckedChange={handleShowLabelsChange}
        />
        <Label>Show Labels</Label>
      </div>
      {config.showLabels && (
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Low Rating Label</Label>
            <Input
              value={config.lowLabel}
              onChange={(e) => handleLowLabelChange(e.target.value)}
              placeholder="Poor"
            />
          </div>
          <div className="space-y-2">
            <Label>High Rating Label</Label>
            <Input
              value={config.highLabel}
              onChange={(e) => handleHighLabelChange(e.target.value)}
              placeholder="Excellent"
            />
          </div>
        </div>
      )}
    </div>
  );
} 