'use client';

import { ChevronDown, ChevronRight, LayoutPanelTop } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { sectionConfigSchema } from './schema';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { FormEngine } from '../../form-engine';

export function SectionEditor({
  id,
  config,
  isSelected,
  onSelect,
  onConfigChange,
}: EditorProps<typeof sectionConfigSchema>) {
  const [isCollapsed, setIsCollapsed] = useState(config.defaultCollapsed);

  return (
    <div
      className={cn(
        'relative rounded-lg transition-all',
        config.showBorder && 'border',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      <div className={cn(
        'flex items-center gap-2 p-4',
        config.showBorder && 'border-b'
      )}>
        <div className="absolute left-2 top-4 text-muted-foreground">
          <LayoutPanelTop className="h-4 w-4" />
        </div>
        <div className="pl-6 flex-1">
          <Label>{config.label}</Label>
          {config.description && (
            <p className="text-sm text-muted-foreground">{config.description}</p>
          )}
        </div>
        {config.collapsible && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
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
            mode="editor"
            config={{
              id: `section-${id}`,
              name: 'Section Content',
              description: '',
              variables: {},
              components: config.components,
            }}
            onConfigChange={(newConfig) => {
              onConfigChange?.({
                ...config,
                components: newConfig.components,
              });
            }}
          />
        </div>
      )}
    </div>
  );
} 