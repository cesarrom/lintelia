'use client';

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { EditorProps } from '../../schemas';
import { SelectConfig, OptionsSource } from '@repo/lintelia/schemas';
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

export function SelectEditor({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  onSelect,
  isSelected,
}: EditorProps<SelectConfig> & {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  error?: string;
}) {
  const { variables } = useVariables();

  // Get options based on source type
  const options = useMemo(() => {
    const source = config.source as OptionsSource;

    if (source.type === 'static') {
      return source.options;
    }

    // Handle variable source
    if (source.type === 'variable') {
      const variableValue = variables[source.variableName];
      if (!Array.isArray(variableValue)) return [];

      return variableValue.map((item: any) => ({
        label: source.labelPath ? get(item, source.labelPath!) : item.toString(),
        value: source.valuePath ? get(item, source.valuePath!) : item.toString(),
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
    <div className={cn(
      'relative rounded-lg border p-4 transition-all',
      isSelected && 'ring-2 ring-primary'
    )}
      onClick={() => onSelect?.()}
    >
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {
        config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )
      }
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
            <SelectItem key={option.value} value={option.value || ' '}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {
        error && (
          <p id={`${id}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )
      }
    </div >
  );
} 