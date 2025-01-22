'use client';

import { Button } from '@/components/ui/button';
import { Fingerprint } from 'lucide-react';
import { useNodes } from 'reactflow';
import { NodeData } from '../types';
import { generateNodeName } from '@/lib/utils';
import { proofOfLifeNode } from '.';

export function ProofOfLifeToolbar() {
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
      ...proofOfLifeNode,
      name: generateNodeName(proofOfLifeNode.type, nodeData),
    }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Button
      variant="outline"
      className="cursor-grab"
      draggable
      onDragStart={onDragStart}
    >
      <Fingerprint className="h-4 w-4 mr-2" />
      Proof of Life
    </Button>
  );
} 