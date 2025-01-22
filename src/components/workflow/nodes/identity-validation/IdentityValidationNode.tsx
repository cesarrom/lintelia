'use client';

import { NodeProps } from 'reactflow';
import { FileCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { IdentityValidationDialog } from './IdentityValidationDialog';
import { IdentityValidationNodeData } from './types';
import { NodeData } from '../types';
import { BaseNode } from '../BaseNode';

export function IdentityValidationNode({ data, ...props }: NodeProps<NodeData>) {
  const identityData = data.config?.identityValidation as IdentityValidationNodeData | undefined;

  return (
    <BaseNode
      {...props}
      data={data}
      Dialog={IdentityValidationDialog}
      Icon={FileCheck}
    >
      {identityData?.config && (
        <div className="flex flex-wrap gap-1 mt-2">
          <Badge variant="outline" className="text-xs">
            {identityData.config.documentType.replace('_', ' ')}
          </Badge>
          {identityData.config.methods.map((method, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {method.toUpperCase()}
            </Badge>
          ))}
        </div>
      )}
    </BaseNode>
  );
} 