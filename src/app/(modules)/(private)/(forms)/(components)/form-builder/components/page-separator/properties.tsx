'use client';

import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PropertiesProps } from '../../schemas';
import { PageSeparatorConfig } from './schema';

export function PageSeparatorProperties({ config, onChange }: PropertiesProps<PageSeparatorConfig>) {
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

  const handleDescriptionChange = useCallback((value: string) => {
    onChange({
      ...config,
      description: value,
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
        <Label>Page Title</Label>
        <Input
          value={config.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Enter page title"
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={config.description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Enter page description"
          rows={3}
        />
      </div>
    </div>
  );
} 