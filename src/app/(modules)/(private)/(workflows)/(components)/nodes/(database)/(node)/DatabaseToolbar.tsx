'use client';

import { Button } from '@/components/ui/button';
import { Database } from 'lucide-react';
import { useNodes } from 'reactflow';
import { NodeData } from '../../../yaml/types';
import { generateNodeName } from '@/lib/utils';
import { databaseNode } from '.';

export function DatabaseToolbar() {
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
      ...databaseNode,
      name: generateNodeName(databaseNode.type, nodeData),
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
      <Database className="h-4 w-4" />
      Database
    </Button>
  );
} 