'use client';

import { Button } from '@/components/ui/button';
import { Table2 } from 'lucide-react';
import { decisionTableNode } from '.';
import { generateNodeName } from '@/lib/utils';
import { useNodes } from 'reactflow';
import { NodeData } from '../types';

export function DecisionTableToolbar() {
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
      ...decisionTableNode,
      name: generateNodeName('decision-table', nodeData),
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
      <Table2 className="h-4 w-4" />
      Decision Table
    </Button>
  );
} 