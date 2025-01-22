'use client';

import { NodeProps } from 'reactflow';
import { Fingerprint } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SchedulerDialog } from './SchedulerDialog';
import { SchedulerNodeData } from './types';
import { NodeData } from '../types';
import { BaseNode } from '../BaseNode';

export function SchedulerNode({ data: d, ...props }: NodeProps<NodeData>) {
  const data = d as unknown as Omit<NodeData, 'config'> & { config: SchedulerNodeData };

  const getScheduleDisplay = () => {
    if (data.config.type === 'absolute') {
      return `At: ${data.config.scheduledDate || 'Not set'}`;
    } else {
      return `In: ${data.config.amount || '0'} ${data.config.unit || 'seconds'}`;
    }
  };

  return (
    <BaseNode
      {...props}
      data={d}
      Dialog={SchedulerDialog}
      Icon={Fingerprint}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Schedule:</span>
        <Badge variant="secondary">{getScheduleDisplay()}</Badge>
      </div>
      {data.config.settings?.retryOnFailure && (
        <Badge variant="outline">Retries: {data.config.settings.maxRetries || 'Unlimited'}</Badge>
      )}
      {data.config.settings?.timezone && (
        <Badge variant="outline">TZ: {data.config.settings.timezone}</Badge>
      )}
    </BaseNode>
  );
} 