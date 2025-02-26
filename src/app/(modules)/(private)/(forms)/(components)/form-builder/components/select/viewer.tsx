'use client';

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../types';
import { selectConfigSchema, selectInputSchema, selectOutputSchema, optionsSourceSchema } from './schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVariables } from '../../context/variables';
import { get } from 'lodash';
import { z } from 'zod';

type OptionsSource = z.infer<typeof optionsSourceSchema>;

export function SelectViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<typeof selectConfigSchema, typeof selectInputSchema, typeof selectOutputSchema>) {
  const { variables } = useVariables();

  // Validate config with schema defaults
  const validatedConfig = useMemo(() => {
    try {
      return selectConfigSchema.parse({
        ...config,
        source: config.source || {
          type: 'static',
          options: [],
        },
      });
    } catch (error) {
      console.error('Invalid select config:', error);
      return {
        ...config,
        source: {
          type: 'static',
          options: [],
        },
      };
    }
  }, [config]);

  // Get options based on source type
  const options = useMemo(() => {
    const source = validatedConfig.source as OptionsSource;
    
    if (source.type === 'static') {
      return source.options;
    }

    // Handle variable source
    if (source.type === 'variable') {
      const variableValue = variables[source.variableId];
      if (!Array.isArray(variableValue)) return [];

      return variableValue.map((item: any) => ({
        label: source.labelPath ? get(item, source.labelPath) : item.toString(),
        value: source.valuePath ? get(item, source.valuePath) : item.toString(),
      }));
    }

    return [];
  }, [validatedConfig.source, variables]);

  const handleChange = (newValue: string) => {
    if (onChange) {
      onChange(newValue);
      if (onBlur) onBlur();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {validatedConfig.label}
        {validatedConfig.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {validatedConfig.description && (
        <p className="text-sm text-muted-foreground">{validatedConfig.description}</p>
      )}
      <Select
        value={value || ''}
        onValueChange={handleChange}
      >
        <SelectTrigger
          id={id}
          className={error ? 'border-destructive' : undefined}
        >
          <SelectValue placeholder={validatedConfig.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 