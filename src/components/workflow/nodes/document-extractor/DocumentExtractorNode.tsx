'use client';

import { useState } from 'react';
import { Handle, Position, NodeProps, useNodes, useReactFlow } from 'reactflow';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DocumentExtractorDialog } from './DocumentExtractorDialog';
import { DocumentExtractorNodeData } from './types';
import { NodeData } from '../types';

export function DocumentExtractorNode({ data }: NodeProps<NodeData>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const extractorData = data.config?.documentExtractor as DocumentExtractorNodeData | undefined;
  const { setNodes } = useReactFlow();
  const allNodeData = useNodes().map((node) => node.data as NodeData);

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
            <CardTitle className="text-sm font-medium">{data.name || 'Document Extractor'}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setDialogOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
          {extractorData?.description && (
            <div className="text-xs text-muted-foreground">
              {extractorData.description}
            </div>
          )}
          {extractorData?.config && (
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge variant="outline" className="text-xs">
                {extractorData.config.documentType.replace('_', ' ')}
              </Badge>
              {extractorData.config.methods.map((method, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {method.toUpperCase()}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>

        <Handle
          type="target"
          position={Position.Left}
          id="input"
          style={{ top: '50%' }}
        />

        <Handle
          type="source"
          position={Position.Right}
          id="success"
          style={{ top: '35%' }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="failure"
          style={{ top: '65%' }}
        />
      </Card>

      <DocumentExtractorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        data={data}
        nodes={allNodeData}
        onSave={handleSave}
      />
    </>
  );
} 