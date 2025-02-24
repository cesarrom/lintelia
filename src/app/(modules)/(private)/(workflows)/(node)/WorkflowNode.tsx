'use client';

import { NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';
import { WorkflowDialog } from './WorkflowDialog';
import { BaseNode } from '../(components)/nodes/BaseNode';
import { NodeData } from '../(components)/yaml/types';
import { WorkflowNodeData } from '../types';

export function WorkflowNode({ data, ...props }: NodeProps<NodeData>) {
  const workflowData = data.config as WorkflowNodeData | undefined;

  return (
    <BaseNode
      {...props}
      data={data}
      Dialog={WorkflowDialog}
      Icon={GitBranch}
    >
      {workflowData?.workflowId && (
        <div className="text-xs text-muted-foreground">
          {workflowData.workflowId}
        </div>
      )}
    </BaseNode>
  );
} 