'use client';

import { ViewerProps } from '../../types';
import { pageSeparatorConfigSchema, pageSeparatorInputSchema, pageSeparatorOutputSchema } from './schema';

export function PageSeparatorViewer({
  id,
  config,
  index,
}: ViewerProps<typeof pageSeparatorConfigSchema, typeof pageSeparatorInputSchema, typeof pageSeparatorOutputSchema>) {
  const pageNumber = index !== undefined ? Math.floor(index / 2) + 1 : 1;

  return (
    <div className="py-8">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="h-px bg-border" />
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
          {config.showTitle && config.label}
          {config.showPageNumber && (
            <span className="rounded-md bg-muted px-2 py-1">Page {pageNumber}</span>
          )}
        </div>
        <div className="flex-1">
          <div className="h-px bg-border" />
        </div>
      </div>
    </div>
  );
} 