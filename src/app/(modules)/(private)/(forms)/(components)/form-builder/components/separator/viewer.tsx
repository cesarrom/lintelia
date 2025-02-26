'use client';

import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../types';
import { separatorConfigSchema, separatorInputSchema, separatorOutputSchema } from './schema';

export function SeparatorViewer({
  id,
  config,
}: ViewerProps<typeof separatorConfigSchema, typeof separatorInputSchema, typeof separatorOutputSchema>) {
  return (
    <div className="space-y-2">
      {config.showLabel && config.label && (
        <>
          <Label>{config.label}</Label>
          {config.description && (
            <p className="text-sm text-muted-foreground">{config.description}</p>
          )}
        </>
      )}
      <Separator />
    </div>
  );
} 