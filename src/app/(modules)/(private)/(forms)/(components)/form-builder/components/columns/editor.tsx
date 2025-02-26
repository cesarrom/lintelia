'use client';

import { useMemo } from 'react';
import { Columns } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { columnsConfigSchema } from './schema';
import { FormEngine } from '../../form-engine';

export function ColumnsEditor({
  id,
  config,
  isSelected,
  onSelect,
  onConfigChange,
}: EditorProps<typeof columnsConfigSchema>) {
  // Parse and validate config with schema defaults
  const validatedConfig = useMemo(() => {
    try {
      return columnsConfigSchema.parse({
        ...config,
        columns: config.columns || [
          { id: '1', width: 6, components: [] },
          { id: '2', width: 6, components: [] },
        ],
        gap: config.gap ?? 4,
      });
    } catch (error) {
      console.error('Invalid columns config:', error);
      return {
        ...config,
        columns: [
          { id: '1', width: 6, components: [] },
          { id: '2', width: 6, components: [] },
        ],
        gap: 4,
      };
    }
  }, [config]);

  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <Columns className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{validatedConfig.label}</Label>
        {validatedConfig.description && (
          <p className="text-sm text-muted-foreground">{validatedConfig.description}</p>
        )}
      </div>
      <div className={`grid grid-cols-12 gap-${validatedConfig.gap}`}>
        {validatedConfig.columns.map((column, index) => (
          <div
            key={column.id}
            className={`col-span-${column.width} space-y-4`}
          >
            <FormEngine
              mode="editor"
              config={{
                id: `${id}-${column.id}`,
                name: `Column ${index + 1}`,
                components: column.components,
                variables: {},
              }}
              onConfigChange={(newConfig) => {
                if (!onConfigChange) return;
                const newColumns = [...validatedConfig.columns];
                newColumns[index] = {
                  ...column,
                  components: newConfig.components,
                };
                onConfigChange({
                  ...validatedConfig,
                  columns: newColumns,
                });
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
} 