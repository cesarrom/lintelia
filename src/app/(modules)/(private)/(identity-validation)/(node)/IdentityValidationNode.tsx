'use client';

import { NodeProps } from 'reactflow';
import { FileCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { IdentityValidationDialog } from './IdentityValidationDialog';
import { BaseNode } from '../../(workflows)/(components)/nodes/BaseNode';
import { NodeData } from '../../(workflows)/(components)/yaml/types';
import { IdentityValidationNodeData } from '../types';

export function IdentityValidationNode({ data, ...props }: NodeProps<NodeData>) {
  const identityData = data.config as IdentityValidationNodeData | undefined;

  return (
    <BaseNode
      {...props}
      data={data}
      Dialog={IdentityValidationDialog}
      Icon={FileCheck}
    >
      {identityData && (
        <div className="flex flex-wrap gap-1 mt-2">
          <Badge variant="outline" className="text-xs">
            {identityData.documentType.replace('_', ' ')}
          </Badge>
          {identityData.methods.map((method, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {method.toUpperCase()}
            </Badge>
          ))}
        </div>
      )}
    </BaseNode>
  );
} 