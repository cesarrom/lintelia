'use client';

import { Button } from '@/components/ui/button';
import { FileSearch } from 'lucide-react';
import { documentExtractorNode } from '.';
import { NodeData } from '../types';
import { useNodes } from 'reactflow';
import { generateNodeName } from '@/lib/utils';

export function DocumentExtractorToolbar() {
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
      ...documentExtractorNode,
      name: generateNodeName(documentExtractorNode.type, nodeData),
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
      <FileSearch className="h-4 w-4 mr-2" />
      Document Extractor
    </Button>
  );
} 