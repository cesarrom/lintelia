'use client';

import { Button } from '@/components/ui/button';
import { ClipboardCheck } from 'lucide-react';
import { reviewNode } from '.';
import { useNodes } from 'reactflow';
import { generateNodeName } from '@/lib/utils';
import { NodeData } from '../../(workflows)/(components)/yaml/types';

export function ReviewToolbar() {
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
    const newNodeData = {
      ...reviewNode,
      name: generateNodeName('review', nodeData),
    };

    event.dataTransfer.setData('application/reactflow', JSON.stringify(newNodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Button
      variant="outline"
      className="gap-2 cursor-move"
      draggable
      onDragStart={onDragStart}
    >
      <ClipboardCheck className="h-4 w-4" />
      Review
    </Button>
  );
} 