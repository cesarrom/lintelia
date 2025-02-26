'use client';

import { ListChecks } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { multiselectConfigSchema } from './schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVariables } from '../../context/variables';
import { get } from 'lodash';

export function MultiselectEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<typeof multiselectConfigSchema>) {
  const { variables, definitions } = useVariables();

  // Get options based on source type
  const options = (() => {
    const source = config.source;
    
    if (source.type === 'static') {
      return source.options;
    }

    // Handle variable source
    const variableValue = variables[source.variableId];
    if (!Array.isArray(variableValue)) return [];

    return variableValue.map((item: any) => ({
      label: source.labelPath ? get(item, source.labelPath) : item.toString(),
      value: source.valuePath ? get(item, source.valuePath) : item.toString(),
    }));
  })();

  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <ListChecks className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder={config.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="mt-1 text-xs text-muted-foreground">
        {config.minSelect && `Min: ${config.minSelect} • `}
        {config.maxSelect && `Max: ${config.maxSelect} • `}
        {config.searchable && 'Searchable • '}
        {config.creatable && 'Creatable'}
      </div>
      {config.source.type === 'variable' && (
        <p className="mt-2 text-xs text-muted-foreground">
          Options from: {definitions[config.source.variableId]?.name}
        </p>
      )}
    </div>
  );
} 