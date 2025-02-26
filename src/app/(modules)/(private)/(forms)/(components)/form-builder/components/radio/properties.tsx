'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { PropertiesProps } from '../../types';
import { radioConfigSchema } from './schema';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function RadioProperties({
  config,
  onChange,
}: PropertiesProps<typeof radioConfigSchema>) {
  const updateConfig = (updates: Partial<typeof config>) => {
    onChange({ ...config, ...updates });
  };

  const addOption = () => {
    const newOption = {
      label: `Option ${config.options.length + 1}`,
      value: `option-${config.options.length + 1}`,
    };
    updateConfig({ options: [...config.options, newOption] });
  };

  const updateOption = (index: number, updates: Partial<typeof config.options[0]>) => {
    const newOptions = [...config.options];
    newOptions[index] = { ...newOptions[index], ...updates };
    updateConfig({ options: newOptions });
  };

  const removeOption = (index: number) => {
    const newOptions = config.options.filter((_, i) => i !== index);
    updateConfig({ options: newOptions });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          value={config.label}
          onChange={(e) => updateConfig({ label: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={config.description || ''}
          onChange={(e) => updateConfig({ description: e.target.value })}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={config.required}
          onCheckedChange={(checked) => updateConfig({ required: checked })}
        />
        <Label>Required</Label>
      </div>

      <div className="space-y-2">
        <Label>Layout</Label>
        <Select
          value={config.layout}
          onValueChange={(value) => updateConfig({ layout: value as 'horizontal' | 'vertical' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vertical">Vertical</SelectItem>
            <SelectItem value="horizontal">Horizontal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Options</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={addOption}
            className="h-8 px-2"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {config.options.map((option, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-2 rounded-lg border p-2',
                config.options.length === 1 && 'border-destructive'
              )}
            >
              <div className="mt-2 text-muted-foreground">
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  value={option.label}
                  onChange={(e) => updateOption(index, { label: e.target.value })}
                  placeholder="Option label"
                />
                <Input
                  value={option.value}
                  onChange={(e) => updateOption(index, { value: e.target.value })}
                  placeholder="Option value"
                />
                <Input
                  value={option.description || ''}
                  onChange={(e) => updateOption(index, { description: e.target.value })}
                  placeholder="Option description (optional)"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeOption(index)}
                disabled={config.options.length === 1}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 