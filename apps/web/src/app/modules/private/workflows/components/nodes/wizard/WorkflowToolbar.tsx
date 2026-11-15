'use client';

import { Button } from '@/components/ui/button';
import { GitBranch } from 'lucide-react';
import { useNodes } from 'reactflow';
import { generateNodeName } from '@/lib/utils';
import { NodeData } from '@repo/fintivio/schemas';
import { workflowNode } from '../workflows';

export function WorkflowToolbar() {
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
      ...workflowNode,
      config: workflowNode.initialConfig || {},
      name: generateNodeName(workflowNode.type, nodeData),
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
      <GitBranch className="h-4 w-4" />
      Workflow
    </Button>
  );
} 