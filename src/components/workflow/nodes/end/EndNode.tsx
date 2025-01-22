'use client';

import { useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import { EndDialog } from './EndDialog';
import { EndNodeData } from './types';
import { NodeData } from '../types';

export function EndNode({ data }: NodeProps<NodeData>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const endData = data.config?.end as EndNodeData | undefined;
  const { setNodes } = useReactFlow();

  const handleSave = (updates: Partial<NodeData>) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.data.id === data.id ? { ...node, data: { ...node.data, ...updates } } : node
      )
    );
  };

  return (
    <>
      <Card className="min-w-[200px]">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{data.name || 'End'}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setDialogOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
          {endData?.description && (
            <div className="text-xs text-muted-foreground">
              {endData.description}
            </div>
          )}
        </CardHeader>

        <Handle
          type="target"
          position={Position.Left}
          id="input"
          style={{ top: '50%' }}
        />
      </Card>

      <EndDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        data={data}
        onSave={handleSave}
      />
    </>
  );
} 