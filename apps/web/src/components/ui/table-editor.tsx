'use client';

import { Button } from './button';
import { Input } from './input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Switch } from './switch';
import { Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ColumnDefinition, DatabaseColumnTypes, databaseColumnTypes } from '@repo/fintivio/schemas';

interface TableEditorProps {
  columns: ColumnDefinition[];
  onChange: (columns: ColumnDefinition[]) => void;
  className?: string;
}

const DATA_TYPES = databaseColumnTypes.options

export function TableEditor({ columns, onChange, className }: TableEditorProps) {
  const addColumn = () => {
    onChange([
      ...columns,
      {
        name: '',
        type: 'text',
        primary: false,
        required: false,
        unique: false,
      },
    ]);
  };

  const updateColumn = (index: number, updates: Partial<ColumnDefinition>) => {
    const newColumns = columns.map((col, i) => {
      if (i === index) {
        return { ...col, ...updates };
      }
      return col;
    });
    onChange(newColumns);
  };

  const removeColumn = (index: number) => {
    onChange(columns.filter((_, i) => i !== index));
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-md border">
        <div className="grid grid-cols-[2fr,1fr,repeat(3,auto),1fr,auto] gap-4 bg-muted p-2 text-sm font-medium">
          <div>Name</div>
          <div>Type</div>
          <div className="text-center">Primary</div>
          <div className="text-center">Nullable</div>
          <div className="text-center">Unique</div>
          <div>Default</div>
          <div></div>
        </div>
        <div className="divide-y">
          {columns.map((column, index) => (
            <div
              key={index}
              className="grid grid-cols-[2fr,1fr,repeat(3,auto),1fr,auto] items-center gap-4 p-2"
            >
              <Input
                value={column.name}
                onChange={(e) => updateColumn(index, { name: e.target.value })}
                placeholder="column_name"
              />
              <Select
                value={column.type}
                onValueChange={(value: DatabaseColumnTypes) => updateColumn(index, { type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DATA_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-center">
                <Switch
                  checked={column.primary}
                  onCheckedChange={(checked: boolean) => {
                    updateColumn(index, { 
                      primary: checked,
                      required: checked ? false : column.required,
                      unique: checked ? true : column.unique,
                    });
                  }}
                />
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={!column.required}
                  onCheckedChange={(checked: boolean) => 
                    updateColumn(index, { 
                      required: !checked,
                      primary: checked ? false : column.primary 
                    })
                  }
                  disabled={column.primary}
                />
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={column.unique}
                  onCheckedChange={(checked: boolean) => 
                    updateColumn(index, { unique: checked })
                  }
                />
              </div>
              <Input
                value={column.defaultValue || ''}
                onChange={(e) => updateColumn(index, { defaultValue: e.target.value })}
                placeholder="default value"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeColumn(index)}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <Button onClick={addColumn} variant="outline" className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add Column
      </Button>
    </div>
  );
} 