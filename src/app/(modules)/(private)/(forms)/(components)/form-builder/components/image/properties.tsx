'use client';

import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PropertiesProps } from '../../types';
import { imageConfigSchema } from './schema';
import { Separator } from '@/components/ui/separator';

export function ImageProperties({
  config,
  onChange,
}: PropertiesProps<typeof imageConfigSchema>) {
  const handleChange = useCallback(
    (field: string) => (value: unknown) => {
      onChange({
        ...config,
        [field]: value,
      });
    },
    [config, onChange]
  );

  const handleCameraOptionsChange = useCallback(
    (field: string) => (value: unknown) => {
      onChange({
        ...config,
        cameraOptions: {
          ...config.cameraOptions,
          [field]: value,
        },
      });
    },
    [config, onChange]
  );

  const handleResolutionChange = useCallback(
    (field: string) => (value: string) => {
      onChange({
        ...config,
        cameraOptions: {
          ...config.cameraOptions,
          idealResolution: {
            ...config.cameraOptions.idealResolution,
            [field]: parseInt(value, 10),
          },
        },
      });
    },
    [config, onChange]
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          value={config.label}
          onChange={(e) => handleChange('label')(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={config.description}
          onChange={(e) => handleChange('description')(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Placeholder</Label>
        <Input
          value={config.placeholder}
          onChange={(e) => handleChange('placeholder')(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Max Size (bytes)</Label>
        <Input
          type="number"
          value={config.maxSize}
          onChange={(e) => handleChange('maxSize')(parseInt(e.target.value, 10))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Max Width (px)</Label>
          <Input
            type="number"
            value={config.maxWidth}
            onChange={(e) => handleChange('maxWidth')(parseInt(e.target.value, 10))}
          />
        </div>
        <div className="space-y-2">
          <Label>Max Height (px)</Label>
          <Input
            type="number"
            value={config.maxHeight}
            onChange={(e) => handleChange('maxHeight')(parseInt(e.target.value, 10))}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="required"
          checked={config.required}
          onCheckedChange={handleChange('required')}
        />
        <Label htmlFor="required">Required</Label>
      </div>

      <Separator className="my-4" />

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="allowCamera"
            checked={config.allowCamera}
            onCheckedChange={handleChange('allowCamera')}
          />
          <Label htmlFor="allowCamera">Allow Camera Capture</Label>
        </div>

        {config.allowCamera && (
          <>
            <div className="space-y-2">
              <Label>Camera Facing Mode</Label>
              <Select
                value={config.cameraOptions.facingMode}
                onValueChange={handleCameraOptionsChange('facingMode')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select camera mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="environment">Back Camera</SelectItem>
                  <SelectItem value="user">Front Camera</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ideal Width (px)</Label>
                <Input
                  type="number"
                  value={config.cameraOptions.idealResolution.width}
                  onChange={(e) => handleResolutionChange('width')(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ideal Height (px)</Label>
                <Input
                  type="number"
                  value={config.cameraOptions.idealResolution.height}
                  onChange={(e) => handleResolutionChange('height')(e.target.value)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 