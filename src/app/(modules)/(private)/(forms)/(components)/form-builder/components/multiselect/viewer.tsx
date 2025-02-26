'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../types';
import { multiselectConfigSchema, multiselectInputSchema, multiselectOutputSchema } from './schema';
import { useVariables } from '../../context/variables';
import { get } from 'lodash';

export function MultiselectViewer({
  id,
  config,
  value = [],
  onChange,
  onBlur,
  error,
}: ViewerProps<typeof multiselectConfigSchema, typeof multiselectInputSchema, typeof multiselectOutputSchema>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { variables } = useVariables();

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

  const handleSelect = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];

    // Validate min/max select
    if (config.minSelect && newValue.length < config.minSelect) return;
    if (config.maxSelect && newValue.length > config.maxSelect) return;

    onChange?.(newValue);
  };

  const handleCreateOption = () => {
    if (!config.creatable || !search || config.source.type !== 'static') return;

    const newOption = {
      label: search,
      value: search.toLowerCase().replace(/\s+/g, '-'),
    };

    // Add the new option and select it
    config.source.options.push(newOption);
    handleSelect(newOption.value);
    setSearch('');
  };

  const selectedOptions = value
    .map(v => options.find(o => o.value === v))
    .filter(Boolean);

  const filteredOptions = options.filter(option => {
    if (!search) return true;
    return option.label.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between',
              error && 'border-destructive',
              !selectedOptions.length && 'text-muted-foreground'
            )}
            onClick={() => setOpen(!open)}
          >
            {selectedOptions.length > 0
              ? `${selectedOptions.length} selected`
              : config.placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            {config.searchable && (
              <CommandInput
                placeholder="Search options..."
                value={search}
                onValueChange={setSearch}
              />
            )}
            <CommandEmpty>
              {config.creatable && config.source.type === 'static' ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={handleCreateOption}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create "{search}"
                </Button>
              ) : (
                'No options found.'
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value.includes(option.value) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map(option => option && (
            <Badge
              key={option.value}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </Badge>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 