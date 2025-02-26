'use client';

import { useMemo } from 'react';
import { ListFilter } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { selectConfigSchema, optionsSourceSchema } from './schema';
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

export function SelectEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<typeof selectConfigSchema>) {
  const { variables, definitions } = useVariables();

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

  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <ListFilter className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{validatedConfig.label}</Label>
        {validatedConfig.description && (
          <p className="text-sm text-muted-foreground">{validatedConfig.description}</p>
        )}
      </div>
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder={validatedConfig.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value || ' '}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {validatedConfig.source.type === 'variable' && (
        <p className="mt-2 text-xs text-muted-foreground">
          Options from: {validatedConfig.source.type === 'variable' ? definitions[(validatedConfig.source as { type: 'variable', variableId: string }).variableId]?.name : ''}
        </p>
      )}
    </div>
  );
} 