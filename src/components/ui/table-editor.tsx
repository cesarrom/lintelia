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

export interface Column {
  name: string;
  type: string;
  isPrimary: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue?: string;
}

interface TableEditorProps {
  columns: Column[];
  onChange: (columns: Column[]) => void;
  className?: string;
}

const DATA_TYPES = [
  'text',
  'varchar',
  'integer',
  'bigint',
  'boolean',
  'date',
  'time',
  'timestamp',
  'json',
  'uuid',
  'float',
  'double',
] as const;

type DataType = typeof DATA_TYPES[number];

export function TableEditor({ columns, onChange, className }: TableEditorProps) {
  const addColumn = () => {
    onChange([
      ...columns,
      {
        name: '',
        type: 'text',
        isPrimary: false,
        isNullable: true,
        isUnique: false,
      },
    ]);
  };

  const updateColumn = (index: number, updates: Partial<Column>) => {
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
                onValueChange={(value: DataType) => updateColumn(index, { type: value })}
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
                  checked={column.isPrimary}
                  onCheckedChange={(checked: boolean) => {
                    updateColumn(index, { 
                      isPrimary: checked,
                      isNullable: checked ? false : column.isNullable,
                      isUnique: checked ? true : column.isUnique,
                    });
                  }}
                />
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={column.isNullable}
                  onCheckedChange={(checked: boolean) => 
                    updateColumn(index, { 
                      isNullable: checked,
                      isPrimary: checked ? false : column.isPrimary 
                    })
                  }
                  disabled={column.isPrimary}
                />
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={column.isUnique}
                  onCheckedChange={(checked: boolean) => 
                    updateColumn(index, { isUnique: checked })
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