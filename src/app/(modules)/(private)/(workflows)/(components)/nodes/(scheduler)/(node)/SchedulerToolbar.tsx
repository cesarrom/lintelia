'use client';

import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import { generateNodeName } from '@/lib/utils';
import { useNodes } from 'reactflow';
import { NodeData } from '../../../yaml/types';
import { schedulerNode } from '.';

export function SchedulerToolbar() {
  const nodes = useNodes();

  const nodeData = nodes
    .map(node => node.data)
    .filter((data): data is NodeData =>
      data !== null &&
      typeof data === 'object' &&
      'name' in data
    );

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({
      ...schedulerNode,
      config: schedulerNode.initialConfig || {},
      name: generateNodeName(schedulerNode.type, nodeData),
    }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Button
      variant="outline"
      className="gap-2 cursor-move"
      draggable
      onDragStart={onDragStart}
    >
      <Clock className="h-4 w-4" />
      Scheduler
    </Button>
  );
} 