'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../schemas';
import { SelectConfig, SelectOption, OptionsSource } from './schema';
import { PropertyWrapper } from '../../property-wrapper';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useVariables } from '../../context/variables';
import { PlusCircle, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';

export function SelectProperties({
  config,
  onChange,
}: PropertiesProps<SelectConfig>) {
  const { variables: vrbs, definitions } = useVariables();
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [newOptionValue, setNewOptionValue] = useState('');

  const handleBasicChange = useCallback(
    (key: keyof SelectConfig, value: any) => {
      onChange({
        ...config,
        [key]: value,
      });
    },
    [config, onChange]
  );

  const handleSourceTypeChange = useCallback(
    (type: 'static' | 'variable') => {
      const newSource: OptionsSource = type === 'static' 
        ? { 
            type: 'static', 
            options: (config.source?.type === 'static' ? config.source.options : []) || [] 
          } 
        : { 
            type: 'variable', 
            variableId: (config.source?.type === 'variable' ? config.source.variableId : '') || '',
            labelPath: (config.source?.type === 'variable' ? config.source.labelPath : '') || '',
            valuePath: (config.source?.type === 'variable' ? config.source.valuePath : '') || ''
          };

      onChange({
        ...config,
        source: newSource,
      });
    },
    [config, onChange]
  );

  const handleAddOption = useCallback(() => {
    if (!newOptionLabel || !newOptionValue) return;
    
    if (config.source?.type !== 'static') return;
    
    const newOption: SelectOption = {
      id: nanoid(),
      label: newOptionLabel,
      value: newOptionValue,
    };
    
    onChange({
      ...config,
      source: {
        ...config.source,
        options: [...(config.source.options || []), newOption],
      },
    });
    
    setNewOptionLabel('');
    setNewOptionValue('');
  }, [config, newOptionLabel, newOptionValue, onChange]);

  const handleRemoveOption = useCallback(
    (id: string) => {
      if (config.source?.type !== 'static') return;
      
      onChange({
        ...config,
        source: {
          ...config.source,
          options: (config.source.options || []).filter(
            (option) => option.id !== id
          ),
        },
      });
    },
    [config, onChange]
  );

  const handleVariableChange = useCallback(
    (variableId: string) => {
      if (config.source?.type !== 'variable') return;
      
      onChange({
        ...config,
        source: {
          ...config.source,
          variableId,
        },
      });
    },
    [config, onChange]
  );

  const handlePathChange = useCallback(
    (key: 'labelPath' | 'valuePath', value: string) => {
      if (config.source?.type !== 'variable') return;
      
      onChange({
        ...config,
        source: {
          ...config.source,
          [key]: value,
        },
      });
    },
    [config, onChange]
  );

  return (
    <Tabs defaultValue="basic">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="basic">Basic</TabsTrigger>
        <TabsTrigger value="options">Options</TabsTrigger>
      </TabsList>
      
      <TabsContent value="basic" className="space-y-4 pt-4">
        <PropertyWrapper>
          <Label htmlFor="propertyName">Property Name</Label>
          <Input
            id="propertyName"
            value={config.propertyName || ''}
            onChange={(e) => handleBasicChange('propertyName', e.target.value)}
          />
        </PropertyWrapper>

        <PropertyWrapper>
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            value={config.label || ''}
            onChange={(e) => handleBasicChange('label', e.target.value)}
          />
        </PropertyWrapper>

        <PropertyWrapper>
          <Label htmlFor="placeholder">Placeholder</Label>
          <Input
            id="placeholder"
            value={config.placeholder || ''}
            onChange={(e) => handleBasicChange('placeholder', e.target.value)}
          />
        </PropertyWrapper>

        <PropertyWrapper>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={config.description || ''}
            onChange={(e) => handleBasicChange('description', e.target.value)}
          />
        </PropertyWrapper>

        <PropertyWrapper>
          <div className="flex items-center justify-between">
            <Label htmlFor="required">Required</Label>
            <Switch
              id="required"
              checked={config.required || false}
              onCheckedChange={(checked) => handleBasicChange('required', checked)}
            />
          </div>
        </PropertyWrapper>
      </TabsContent>
      
      <TabsContent value="options" className="space-y-4 pt-4">
        <PropertyWrapper>
          <Label>Options Source</Label>
          <Select
            value={config.source?.type || 'static'}
            onValueChange={(value) => handleSourceTypeChange(value as 'static' | 'variable')}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select source type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="static">Static Options</SelectItem>
              <SelectItem value="variable">From Variable</SelectItem>
            </SelectContent>
          </Select>
        </PropertyWrapper>

        {config.source?.type === 'static' && (
          <>
            <PropertyWrapper>
              <Label>Add Option</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Label"
                  value={newOptionLabel}
                  onChange={(e) => setNewOptionLabel(e.target.value)}
                />
                <Input
                  placeholder="Value"
                  value={newOptionValue}
                  onChange={(e) => setNewOptionValue(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={handleAddOption}
                disabled={!newOptionLabel || !newOptionValue}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Option
              </Button>
            </PropertyWrapper>

            <div className="space-y-2">
              <Label>Options</Label>
              {config.source.options?.map((option) => (
                <div
                  key={option.id}
                  className="flex items-center justify-between rounded-md border p-2"
                >
                  <div>
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.value}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOption(option.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {(!config.source.options || config.source.options.length === 0) && (
                <p className="text-sm text-muted-foreground">No options added yet</p>
              )}
            </div>
          </>
        )}

        {config.source?.type === 'variable' && (
          <>
            <PropertyWrapper>
              <Label htmlFor="variableId">Variable</Label>
              <Select
                value={config.source.variableId || ''}
                onValueChange={handleVariableChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select variable" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(definitions || {}).map(([id, value]) => (
                    <SelectItem key={id} value={id}>
                      {id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyWrapper>

            <PropertyWrapper>
              <Label htmlFor="labelPath">Label Path</Label>
              <Input
                id="labelPath"
                value={config.source.labelPath || ''}
                onChange={(e) => handlePathChange('labelPath', e.target.value)}
                placeholder="e.g. name"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Path to the property to use as label (leave empty for simple arrays)
              </p>
            </PropertyWrapper>

            <PropertyWrapper>
              <Label htmlFor="valuePath">Value Path</Label>
              <Input
                id="valuePath"
                value={config.source.valuePath || ''}
                onChange={(e) => handlePathChange('valuePath', e.target.value)}
                placeholder="e.g. id"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Path to the property to use as value (leave empty for simple arrays)
              </p>
            </PropertyWrapper>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}