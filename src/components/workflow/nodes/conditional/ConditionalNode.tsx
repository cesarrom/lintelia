'use client';

import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { GitBranchPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ConditionalNodeData } from './types';
import { ConditionalDialog } from './ConditionalDialog';
import { NodeData } from '../types';
import { BaseNode } from '../BaseNode';

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
          <Badge variant="outline" className="text-xs">
            {conditionalData.condition.operator}
          </Badge>
          {conditionalData.expression && (
            <Badge variant="outline" className="text-xs">
              expression
            </Badge>
          )}
        </div>
      )}
    </BaseNode>
  );
}

export const ConditionalNode = memo(ConditionalNodeComponent); 