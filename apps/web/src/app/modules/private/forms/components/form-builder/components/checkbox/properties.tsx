'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../schemas';
import { CheckboxConfig } from '@repo/lintelia/schemas';

export function CheckboxProperties({
  config,
  onChange,
}: PropertiesProps<CheckboxConfig>) {
  const handlePropertyNameChange = (value: string) => {
    onChange({ ...config, propertyName: value });
  };

  const handleLabelChange = (value: string) => {
    onChange({ ...config, label: value });
  };

  const handleDescriptionChange = (value: string) => {
    onChange({ ...config, description: value });
  };

  const handleTextChange = (value: string) => {
    onChange({ ...config, text: value });
  };

  const handleRequiredChange = (checked: boolean) => {
    onChange({ ...config, required: checked });
  };

  const handleDefaultCheckedChange = (checked: boolean) => {
    onChange({ ...config, defaultChecked: checked });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Property Name</Label>
        <Input
          value={config.propertyName}
          onChange={(e) => handlePropertyNameChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          value={config.label || ''}
          onChange={(e) => handleLabelChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={config.description || ''}
          onChange={(e) => handleDescriptionChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Text</Label>
        <Input
          value={config.text}
          onChange={(e) => handleTextChange(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Required</Label>
        <Switch
          checked={config.required}
          onCheckedChange={handleRequiredChange}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Default Checked</Label>
        <Switch
          checked={config.defaultChecked}
          onCheckedChange={handleDefaultCheckedChange}
        />
      </div>
    </div>
  );
} 