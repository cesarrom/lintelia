'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../types';
import { sectionConfigSchema, sectionInputSchema, sectionOutputSchema } from './schema';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { FormEngine } from '../../form-engine';

export function SectionViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<typeof sectionConfigSchema, typeof sectionInputSchema, typeof sectionOutputSchema>) {
  const [isCollapsed, setIsCollapsed] = useState(config.defaultCollapsed);

  return (
    <div className={cn(
      'rounded-lg',
      config.showBorder && 'border',
      error ? 'border-destructive' : undefined
    )}>
      <div className={cn(
        'flex items-center gap-2 p-4',
        config.showBorder && 'border-b'
      )}>
        <div className="flex-1">
          <Label>{config.label}</Label>
          {config.description && (
            <p className="text-sm text-muted-foreground">{config.description}</p>
          )}
        </div>
        {config.collapsible && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      {!isCollapsed && (
        <div className="p-4">
          <FormEngine
            mode="viewer"
            config={{
              id: `section-${id}`,
              name: 'Section Content',
              description: '',
              variables: {},
              components: config.components,
            }}
            initialValues={value as Record<string, unknown>}
            onChange={onChange}
          />
        </div>
      )}
      {error && <p className="px-4 pb-4 text-sm text-destructive">{error}</p>}
    </div>
  );
} 