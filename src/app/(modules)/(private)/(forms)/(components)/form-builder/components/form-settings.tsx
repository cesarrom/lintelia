'use client';

import { useState } from 'react';
import { FormConfig, FormVariable } from '../schemas';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface FormSettingsProps {
  config: FormConfig;
  onChange: (config: FormConfig) => void;
}

export function FormSettings({ config, onChange }: FormSettingsProps) {
  const [newVariable, setNewVariable] = useState<Partial<FormVariable>>({
    name: '',
    type: 'string',
  });

  const updateConfig = (updates: Partial<FormConfig>) => {
    onChange({ ...config, ...updates });
  };

  const addVariable = () => {
    if (!newVariable.name) return;

    const variableKey = newVariable.name.toLowerCase().replace(/\s+/g, '_');
    updateConfig({
      variables: {
        ...config.variables,
        [variableKey]: {
          name: newVariable.name,
          type: newVariable.type || 'string',
          required: false,
        },
      },
    });

    setNewVariable({ name: '', type: 'string' });
  };

  const removeVariable = (key: string) => {
    const newVariables = { ...config.variables };
    delete newVariables[key];
    updateConfig({ variables: newVariables });
  };

  const updateVariable = (key: string, updates: Partial<FormVariable>) => {
    updateConfig({
      variables: {
        ...config.variables,
        [key]: { ...config.variables[key], ...updates },
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Settings */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Form Name</Label>
          <Input
            value={config.name}
            onChange={(e) => updateConfig({ name: e.target.value })}
            placeholder="Enter form name"
          />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={config.description || ''}
            onChange={(e) => updateConfig({ description: e.target.value })}
            placeholder="Enter form description"
          />
        </div>
      </div>

      <Separator />

      {/* Variables */}
      <div className="space-y-4">
        <Label>Variables</Label>

        {/* Add New Variable */}
        <div className="flex gap-2">
          <Input
            value={newVariable.name}
            onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
            placeholder="Variable name"
            className="flex-1"
          />
          <Select
            value={newVariable.type}
            onValueChange={(value) => setNewVariable({ ...newVariable, type: value as FormVariable['type'] })}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">String</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="array">Array</SelectItem>
              <SelectItem value="object">Object</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={addVariable}
            disabled={!newVariable.name}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Variables List */}
        <div className="space-y-2">
          {Object.entries(config.variables || {}).map(([key, variable]) => (
            <div key={key} className="flex items-start gap-2 rounded-lg border p-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={variable.name}
                    onChange={(e) => updateVariable(key, { name: e.target.value })}
                  />
                  <Select
                    value={variable.type}
                    onValueChange={(value) => updateVariable(key, { type: value as FormVariable['type'] })}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="array">Array</SelectItem>
                      <SelectItem value="object">Object</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={variable.required}
                      onCheckedChange={(checked) => updateVariable(key, { required: checked })}
                    />
                    <Label>Required</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Description</Label>
                  <Input
                    value={variable.description || ''}
                    onChange={(e) => updateVariable(key, { description: e.target.value })}
                    placeholder="Variable description"
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => removeVariable(key)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 