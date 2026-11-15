'use client';

import { ViewerProps } from '../../schemas';
import { PageSeparatorConfig } from '@repo/fintivio/schemas';

export function PageSeparatorViewer({
  id,
  config,
}: ViewerProps<PageSeparatorConfig, undefined>) {
  return (
    <div className="py-6">
      <div className="w-full border-t border-dashed border-primary/50 my-2" />
      <div className="flex flex-col items-center justify-center text-center">
        <h3 className="text-lg font-semibold mt-2">{config.title}</h3>
        {config.description && (
          <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
        )}
      </div>
    </div>
  );
} 