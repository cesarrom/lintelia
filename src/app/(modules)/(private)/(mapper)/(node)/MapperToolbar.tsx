'use client';

import { Button } from '@/components/ui/button';
import { ArrowRightLeft } from 'lucide-react';
import { mapperNode } from '.';
import { generateNodeName } from '@/lib/utils';
import { useNodes } from 'reactflow';
import { NodeData } from '../types';

export function MapperToolbar() {
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
      ...mapperNode,
      name: generateNodeName(mapperNode.type, nodeData),
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
      <ArrowRightLeft className="h-4 w-4" />
      Mapper
    </Button>
  );
} 