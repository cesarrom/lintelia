'use client';

import { useCallback } from 'react';
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
import { SeparatorConfig } from './schema';

export function SeparatorProperties({ config, onChange }: PropertiesProps<SeparatorConfig>) {
  const handlePropertyNameChange = useCallback((value: string) => {
    onChange({
      ...config,
      propertyName: value,
    });
  }, [config, onChange]);

  const handleTitleChange = useCallback((value: string) => {
    onChange({
      ...config,
      title: value,
    });
  }, [config, onChange]);

  const handleShowTitleChange = useCallback((value: boolean) => {
    onChange({
      ...config,
      showTitle: value,
    });
  }, [config, onChange]);

  const handleOrientationChange = useCallback((value: 'horizontal' | 'vertical') => {
    onChange({
      ...config,
      orientation: value,
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
      <div className="flex items-center space-x-2">
        <Switch
          checked={config.showTitle}
          onCheckedChange={handleShowTitleChange}
        />
        <Label>Show Title</Label>
      </div>
      {config.showTitle ? (
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={config.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Enter title (optional)"
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label>Orientation</Label>
        <Select
          value={config.orientation}
          onValueChange={(value) => handleOrientationChange(value as 'horizontal' | 'vertical')}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select orientation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="horizontal">Horizontal</SelectItem>
            <SelectItem value="vertical">Vertical</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
} 