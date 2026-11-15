'use client';

import { Separator } from '@/components/ui/separator';
import { SeparatorConfig } from './schema';
import { ViewerProps } from '../../schemas';

export function SeparatorViewer({
  id,
  config,
}: ViewerProps<SeparatorConfig, null>) {
  return (
    <div className="w-full">
      {config.showTitle && config.title && (
        <p className="text-sm font-medium mb-2">{config.title}</p>
      )}
      <Separator 
        className="my-2" 
        orientation={config.orientation}
      />
    </div>
  );
} 