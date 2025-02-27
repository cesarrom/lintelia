'use client';

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../schemas';
import { SelectConfig, OptionsSource, SelectOption } from './schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVariables } from '../../context/variables';
import { get } from 'lodash';
import { cn } from '@/lib/utils';
import { nanoid } from 'nanoid';

export function SelectViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<SelectConfig, string>) {
  const { variables } = useVariables();

  // Get options based on source type
  const options = useMemo(() => {
    const source = config.source as OptionsSource;
    
    if (source.type === 'static') {
      return source.options;
    }

    // Handle variable source
    if (source.type === 'variable') {
      const variableValue = variables[source.variableId];
      if (!Array.isArray(variableValue)) return [];

      return variableValue.map((item: any) => ({
        id: nanoid(),
        label: source.labelPath ? get(item, source.labelPath) : item.toString(),
        value: source.valuePath ? get(item, source.valuePath) : item.toString(),
      }));
    }

    return [];
  }, [config.source, variables]);

  const handleChange = (newValue: string) => {
    if (onChange) {
      onChange(newValue);
      if (onBlur) onBlur();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <Select
        value={value || ''}
        onValueChange={handleChange}
      >
        <SelectTrigger
          id={id}
          name={config.propertyName}
          className={cn(error ? 'border-destructive' : undefined)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <SelectValue placeholder={config.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
} 