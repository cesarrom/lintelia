'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { PropertiesProps } from '../../types';
import { selectConfigSchema } from './schema';
import { useVariables } from '../../context/variables';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { useState } from 'react';

type SelectConfig = z.infer<typeof selectConfigSchema>;
type StaticSource = Extract<SelectConfig['source'], { type: 'static' }>;
type VariableSource = Extract<SelectConfig['source'], { type: 'variable' }>;

export function SelectProperties({
  config,
  onChange,
}: PropertiesProps<typeof selectConfigSchema>) {
  const { definitions } = useVariables();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const updateConfig = (updates: Partial<SelectConfig>) => {
    onChange({ ...config, ...updates });
  };

  const validateAndUpdateOptions = (newOptions: StaticSource['options']) => {
    const errors: Record<string, string> = {};
    let hasErrors = false;

    newOptions.forEach((option, index) => {
      if (!option.label.trim()) {
        errors[`label-${index}`] = 'Label cannot be empty';
        hasErrors = true;
      }
      if (!option.value.trim()) {
        errors[`value-${index}`] = 'Value cannot be empty';
        hasErrors = true;
      }
    });

    setValidationErrors(errors);
    return !hasErrors;
  };

  return (
    <div className="space-y-6">
      {/* Basic Properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Label</Label>
          <Input
            value={config.label}
            onChange={(e) => updateConfig({ label: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Placeholder</Label>
          <Input
            value={config.placeholder || ''}
            onChange={(e) => updateConfig({ placeholder: e.target.value })}
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
      </div>

      {/* Options Source */}
      <div className="space-y-4">
        <Label>Options Source</Label>
        <Select
          value={config.source?.type || 'static'}
          onValueChange={(value: 'static' | 'variable') => {
            if (value === 'static') {
              updateConfig({
                source: {
                  type: 'static',
                  options: [],
                },
              });
            } else {
              updateConfig({
                source: {
                  type: 'variable',
                  variableId: '',
                },
              });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select options source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="static">Static Options</SelectItem>
            <SelectItem value="variable">From Variable</SelectItem>
          </SelectContent>
        </Select>

        {/* Static Options */}
        {config.source?.type === 'static' && (
          <div className="space-y-4">
            <div className="space-y-2">
              {config.source.options.map((option, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Input
                        value={option.label}
                        onChange={(e) => {
                          if (config.source.type !== 'static') return;
                          const newOptions = [...config.source.options];
                          newOptions[index] = {
                            ...newOptions[index],
                            label: e.target.value,
                          };
                          validateAndUpdateOptions(newOptions);
                          updateConfig({
                            source: {
                              type: 'static',
                              options: newOptions,
                            },
                          });
                        }}
                        placeholder="Option label"
                        className={validationErrors[`label-${index}`] ? 'border-red-500' : ''}
                      />
                      {validationErrors[`label-${index}`] && (
                        <p className="text-xs text-red-500">{validationErrors[`label-${index}`]}</p>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <Input
                        value={option.value}
                        onChange={(e) => {
                          if (config.source.type !== 'static') return;
                          const newOptions = [...config.source.options];
                          newOptions[index] = {
                            ...newOptions[index],
                            value: e.target.value,
                          };
                          validateAndUpdateOptions(newOptions);
                          updateConfig({
                            source: {
                              type: 'static',
                              options: newOptions,
                            },
                          });
                        }}
                        placeholder="Option value"
                        className={validationErrors[`value-${index}`] ? 'border-red-500' : ''}
                      />
                      {validationErrors[`value-${index}`] && (
                        <p className="text-xs text-red-500">{validationErrors[`value-${index}`]}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (config.source.type !== 'static') return;
                        const newOptions = [...config.source.options];
                        newOptions.splice(index, 1);
                        updateConfig({
                          source: {
                            type: 'static',
                            options: newOptions,
                          },
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                if (config.source.type !== 'static') return;
                const newOptions = [...config.source.options];
                const newOptionNumber = newOptions.length + 1;
                newOptions.push({ 
                  label: `Option ${newOptionNumber}`, 
                  value: `option_${newOptionNumber}` 
                });
                updateConfig({
                  source: {
                    type: 'static',
                    options: newOptions,
                  },
                });
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Option
            </Button>
          </div>
        )}

        {/* Variable Source */}
        {config.source?.type === 'variable' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Variable</Label>
              <Select
                value={config.source.variableId}
                onValueChange={(value) => {
                  updateConfig({
                    source: {
                      type: 'variable',
                      variableId: value,
                      labelPath: config.source.type === 'variable' ? config.source.labelPath : undefined,
                      valuePath: config.source.type === 'variable' ? config.source.valuePath : undefined,
                    },
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a variable" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(definitions)
                    .filter(([_, def]) => def.type === 'array')
                    .map(([id, def]) => (
                      <SelectItem key={id} value={id}>
                        {def.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Label Path</Label>
              <Input
                value={config.source.labelPath || ''}
                onChange={(e) => {
                  if (config.source.type !== 'variable') return;
                  updateConfig({
                    source: {
                      type: 'variable',
                      variableId: config.source.variableId,
                      labelPath: e.target.value,
                      valuePath: config.source.valuePath,
                    },
                  });
                }}
                placeholder="e.g., name"
              />
            </div>

            <div className="space-y-2">
              <Label>Value Path</Label>
              <Input
                value={config.source.valuePath || ''}
                onChange={(e) => {
                  if (config.source.type !== 'variable') return;
                  updateConfig({
                    source: {
                      type: 'variable',
                      variableId: config.source.variableId,
                      labelPath: config.source.labelPath,
                      valuePath: e.target.value,
                    },
                  });
                }}
                placeholder="e.g., id"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 