'use client';

import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';
import { useNodes } from 'reactflow';
import { emailNode } from '.';
import { generateNodeName } from '@/lib/utils';
import { NodeData } from '../types';

export function EmailToolbar() {
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
      ...emailNode,
      name: generateNodeName('email', nodeData),
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
      <Mail className="h-4 w-4" />
      Email
    </Button>
  );
} 