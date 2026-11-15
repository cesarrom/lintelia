'use client';

import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { useNodes } from 'reactflow';
import { endNode } from '.';
import { generateNodeName } from '@/lib/utils';
import { NodeData } from '../../../yaml/types';

export function EndNodeToolbar() {
  const nodes = useNodes();

  // Map ReactFlow nodes to NodeData for name generation
  const nodeData = nodes
    .map(node => node.data)
    .filter((data): data is NodeData =>
      data !== null &&
      typeof data === 'object' &&
      'name' in data
    );

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({
      ...endNode,
      name: generateNodeName(endNode.type, nodeData),
    }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <>
      <Button
        variant="outline"
        className="gap-2 cursor-move"
        draggable
        onDragStart={onDragStart}
      >
        <Settings className="h-4 w-4" />
        End
      </Button>
    </>
  );
} 