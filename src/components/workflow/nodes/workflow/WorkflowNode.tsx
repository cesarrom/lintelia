'use client';

import { NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';
import { WorkflowDialog } from './WorkflowDialog';
import { WorkflowNodeData } from './types';
import { NodeData } from '../types';
import { BaseNode } from '../BaseNode';

export function WorkflowNode({ data, ...props }: NodeProps<NodeData>) {
  const workflowData = data.config?.workflow as WorkflowNodeData | undefined;

  return (
    <BaseNode
      {...props}
      data={data}
      Dialog={WorkflowDialog}
      Icon={GitBranch}
    >
      {workflowData?.selectedWorkflow && (
        <div className="text-xs text-muted-foreground">
          {workflowData.selectedWorkflow}
        </div>
      )}
    </BaseNode>
  );
} 