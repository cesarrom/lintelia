'use client';

import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { GitBranchPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ConditionalNodeData } from '../types';
import { ConditionalDialog } from './ConditionalDialog';
import { BaseNode } from '../BaseNode';
import { NodeData } from '@repo/fintivio/schemas';

function ConditionalNodeComponent({ data, ...props }: NodeProps<NodeData>) {
  const conditionalData = data.config?.conditional as ConditionalNodeData | undefined;

  return (
    <BaseNode
      {...props}
      data={data}
      Dialog={ConditionalDialog}
      Icon={GitBranchPlus}
    >
      {conditionalData && (
        <div className="mt-2 flex flex-wrap gap-1">
          {conditionalData.leftValue && (
            <Badge variant="outline" className="text-xs">
              {conditionalData.leftValue}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {conditionalData.operator}
          </Badge>
          {conditionalData.rightValue && (
            <Badge variant="outline" className="text-xs">
              {conditionalData.rightValue}
            </Badge>
          )}
        </div>
      )}
    </BaseNode>
  );
}

export const ConditionalNode = memo(ConditionalNodeComponent); 