'use client';

import { Button } from '@/components/ui/button';
import { GitBranchPlus } from 'lucide-react';
import { conditionalNode } from '.';
import { useNodes } from 'reactflow';
import { NodeData } from '../types';
import { generateNodeName } from '@/lib/utils';

export function ConditionalToolbar() {
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
      ...conditionalNode,
      name: generateNodeName(conditionalNode.type, nodeData),
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
      <GitBranchPlus className="h-4 w-4" />
      Conditional
    </Button>
  );
} 