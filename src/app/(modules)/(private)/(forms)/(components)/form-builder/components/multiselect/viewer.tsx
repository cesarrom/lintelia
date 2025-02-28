'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../schemas';
import { MultiselectConfig } from './schema';
import { useVariables } from '../../context/variables';
import { get } from 'lodash';
import { useController, ControllerFieldState, ControllerRenderProps } from 'react-hook-form';

// Define option type
interface SelectOption {
  label: string;
  value: string;
}

export function MultiselectViewer({
  id,
  config,
  value = [],
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<MultiselectConfig, string[]>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { variables } = useVariables();

  // Check if we're using react-hook-form
  const isUsingReactHookForm = !!register && !!formState && !!control;
  
  // Use controller for react-hook-form if available
  const controllerResult = isUsingReactHookForm 
    ? useController({
        name: config.propertyName,
        control,
        defaultValue: value || [],
        rules: {
          required: config.required ? 'This field is required' : false,
          validate: {
            minSelect: (val) => {
              if (!config.minSelect) return true;
              return (val?.length || 0) >= config.minSelect || 
                `Please select at least ${config.minSelect} option${config.minSelect !== 1 ? 's' : ''}`;
            },
            maxSelect: (val) => {
              if (!config.maxSelect) return true;
              return (val?.length || 0) <= config.maxSelect || 
                `Please select at most ${config.maxSelect} option${config.maxSelect !== 1 ? 's' : ''}`;
            }
          }
        }
      })
    : null;
  
  const field = controllerResult?.field || {} as Partial<ControllerRenderProps>;
  const fieldState = controllerResult?.fieldState || {} as Partial<ControllerFieldState>;

  // Get error message from react-hook-form or from props
  const errorMessage = isUsingReactHookForm && fieldState.error
    ? fieldState.error.message 
    : error;

  // Get current value
  const currentValue = isUsingReactHookForm && Array.isArray(field.value) 
    ? field.value 
    : (value as string[]);

  // Get options based on source type
  const options = (() => {
    const source = config.source;
    
    if (source.type === 'static') {
      return source.options;
    }

    // Handle variable source
    if (source.type === 'variable') {
      const variableValue = variables[source.variableName];
      if (!Array.isArray(variableValue)) return [];
  
      return variableValue.map((item: any) => ({
        label: item.toString(),
        value: item.toString(),
      }));
    }

    // Handle API source
    if (source.type === 'api') {
      const variableValue = variables[source.endpoint] || [];
      if (!Array.isArray(variableValue)) return [];
  
      return variableValue.map((item: any) => ({
        label: source.labelPath ? get(item, source.labelPath) : item.toString(),
        value: source.valuePath ? get(item, source.valuePath) : item.toString(),
      }));
    }

    return [];
  })();

  const handleSelect = (optionValue: string) => {
    const newValue = currentValue.includes(optionValue)
      ? currentValue.filter(v => v !== optionValue)
      : [...currentValue, optionValue];

    // Validate min/max select
    if (config.minSelect && newValue.length < config.minSelect) return;
    if (config.maxSelect && newValue.length > config.maxSelect) return;

    if (isUsingReactHookForm && field.onChange) {
      field.onChange(newValue);
      if (field.onBlur) field.onBlur();
    } else if (onChange) {
      onChange(newValue);
      if (onBlur) onBlur();
    }
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

  const selectedOptions = currentValue
    .map(v => options.find(o => o.value === v))
    .filter(Boolean) as SelectOption[];

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
              errorMessage && 'border-destructive',
              !selectedOptions.length && 'text-muted-foreground'
            )}
            onClick={() => setOpen(!open)}
            id={id}
            name={config.propertyName}
            ref={isUsingReactHookForm && field.ref ? field.ref : undefined}
            onBlur={() => {
              if (isUsingReactHookForm && field.onBlur) field.onBlur();
              else if (onBlur) onBlur();
            }}
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
                      currentValue.includes(option.value) ? 'opacity-100' : 'opacity-0'
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

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
} 