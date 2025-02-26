'use client';

import { useMemo } from 'react';
import { ViewerProps } from '../../types';
import { columnsConfigSchema, columnsInputSchema, columnsOutputSchema } from './schema';
import { FormEngine } from '../../form-engine';

export function ColumnsViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
}: ViewerProps<typeof columnsConfigSchema, typeof columnsInputSchema, typeof columnsOutputSchema>) {
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
    <div className="space-y-2">
      {validatedConfig.label && (
        <div>
          <div className="font-medium">{validatedConfig.label}</div>
          {validatedConfig.description && (
            <p className="text-sm text-muted-foreground">{validatedConfig.description}</p>
          )}
        </div>
      )}
      <div className={`grid grid-cols-12 gap-${validatedConfig.gap}`}>
        {validatedConfig.columns.map((column, index) => (
          <div
            key={column.id}
            className={`col-span-${column.width} space-y-4`}
          >
            <FormEngine
              mode="viewer"
              config={{
                id: `${id}-${column.id}`,
                name: `Column ${index + 1}`,
                components: column.components,
                variables: {},
              }}
              initialValues={value?.[column.id]}
              onChange={(newValues) => {
                if (!onChange) return;
                onChange({
                  ...value,
                  [column.id]: newValues,
                });
              }}
              onSubmit={() => {}}
            />
          </div>
        ))}
      </div>
    </div>
  );
} 