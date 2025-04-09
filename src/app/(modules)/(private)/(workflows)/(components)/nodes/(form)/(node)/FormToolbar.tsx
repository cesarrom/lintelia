'use client';

import { Button } from '@/components/ui/button';
import { FormInput } from 'lucide-react';
import { formNode } from '.';
import { useNodes } from 'reactflow';
import { generateNodeName } from '@/lib/utils';
import { NodeData } from '../../../yaml/types';

export function FormToolbar() {
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
      ...formNode,
      name: generateNodeName('form', nodeData),
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
      <FormInput className="h-4 w-4" />
      Form
    </Button>
  );
} 