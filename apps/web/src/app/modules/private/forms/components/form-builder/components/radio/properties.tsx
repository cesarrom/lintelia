'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PropertiesProps } from '../../schemas';
import { RadioComponentSchema } from './schema';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { RadioConfig, RadioOption } from '@repo/lintelia/schemas';

export function RadioProperties({ config, onChange }: PropertiesProps<RadioConfig>) {
  const schemaRef = useRef(new RadioComponentSchema(config.propertyName));
  const [options, setOptions] = useState<RadioOption[]>(config.options || []);

  useEffect(() => {
    schemaRef.current = new RadioComponentSchema(config.propertyName);
    if (config.required) {
      schemaRef.current.setRequired(true);
    }
    if (config.options) {
      schemaRef.current.setOptions(config.options);
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

  const handleLayoutChange = useCallback((value: 'horizontal' | 'vertical') => {
    onChange({
      ...config,
      layout: value,
    });
  }, [config, onChange]);

  const handleDefaultValueChange = useCallback((value: string) => {
    onChange({
      ...config,
      defaultValue: value,
    });
  }, [config, onChange]);

  const handleAddOption = useCallback(() => {
    const newOption: RadioOption = {
      label: `Option ${options.length + 1}`,
      value: `option-${uuid().slice(0, 8)}`,
    };
    
    const newOptions = [...options, newOption];
    setOptions(newOptions);
    
    onChange({
      ...config,
      options: newOptions,
    });
  }, [options, config, onChange]);

  const handleRemoveOption = useCallback((index: number) => {
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
    
    onChange({
      ...config,
      options: newOptions,
      defaultValue: config.defaultValue && !newOptions.some(o => o.value === config.defaultValue)
        ? undefined
        : config.defaultValue,
    });
  }, [options, config, onChange]);

  const handleOptionChange = useCallback((index: number, field: keyof RadioOption, value: string) => {
    const newOptions = [...options];
    newOptions[index] = {
      ...newOptions[index],
      [field]: value,
    };
    setOptions(newOptions);
    
    onChange({
      ...config,
      options: newOptions,
      defaultValue: field === 'value' && config.defaultValue === options[index].value
        ? value
        : config.defaultValue,
    });
  }, [options, config, onChange]);

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
        <Label>Layout</Label>
        <Select
          value={config.layout}
          onValueChange={(value) => handleLayoutChange(value as 'horizontal' | 'vertical')}
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
        <Label>Default Value</Label>
        <Select
          value={config.defaultValue || ''}
          onValueChange={handleDefaultValueChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a default value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=" ">None</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <Separator />
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>Options</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddOption}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Option
          </Button>
        </div>
        
        <div className="space-y-3">
          {options.map((option, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <Input
                  value={option.label}
                  onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
                  placeholder="Option label"
                />
                <Input
                  value={option.value}
                  onChange={(e) => handleOptionChange(index, 'value', e.target.value)}
                  placeholder="Option value"
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => handleRemoveOption(index)}
                disabled={options.length <= 1}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          
          {options.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-2">
              No options added yet. Click "Add Option" to add one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 