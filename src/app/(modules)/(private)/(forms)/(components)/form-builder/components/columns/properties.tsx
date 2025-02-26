'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';
import { PropertiesProps } from '../../types';
import { columnsConfigSchema } from './schema';

export function ColumnsProperties({
  config,
  onChange,
}: PropertiesProps<typeof columnsConfigSchema>) {
  const updateConfig = (updates: Partial<typeof config>) => {
    onChange({ ...config, ...updates });
  };

  const addColumn = () => {
    const newColumns = [...config.columns];
    const id = String(newColumns.length + 1);
    newColumns.push({ id, width: 6, components: [] });
    updateConfig({ columns: newColumns });
  };

  const removeColumn = (index: number) => {
    const newColumns = [...config.columns];
    newColumns.splice(index, 1);
    updateConfig({ columns: newColumns });
  };

  const updateColumnWidth = (index: number, width: number) => {
    const newColumns = [...config.columns];
    newColumns[index] = { ...newColumns[index], width };
    updateConfig({ columns: newColumns });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          value={config.label}
          onChange={(e) => updateConfig({ label: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={config.description || ''}
          onChange={(e) => updateConfig({ description: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Gap</Label>
        <Select
          value={String(config.gap)}
          onValueChange={(value) => updateConfig({ gap: Number(value) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((gap) => (
              <SelectItem key={gap} value={String(gap)}>
                {gap}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Columns</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={addColumn}
            disabled={config.columns.length >= 4}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2">
          {config.columns.map((column, index) => (
            <div key={column.id} className="flex items-center gap-2">
              <Select
                value={String(column.width)}
                onValueChange={(value) => updateColumnWidth(index, Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((width) => (
                    <SelectItem key={width} value={String(width)}>
                      {width}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeColumn(index)}
                disabled={config.columns.length <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 