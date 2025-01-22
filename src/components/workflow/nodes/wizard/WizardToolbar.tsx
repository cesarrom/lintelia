'use client';

import { Button } from '@/components/ui/button';
import { ListChecks } from 'lucide-react';
import { useNodes } from 'reactflow';
import { NodeData } from '../types';
import { wizardNode } from '.';
import { generateNodeName } from '@/lib/utils';

export function WizardToolbar() {
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
      ...wizardNode,
      config: wizardNode.initialConfig || {},
      name: generateNodeName(wizardNode.type, nodeData),
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
      <ListChecks className="h-4 w-4 mr-2" />
      Wizard
    </Button>
  );
} 