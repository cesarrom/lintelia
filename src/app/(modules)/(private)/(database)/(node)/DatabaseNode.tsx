'use client';

import { NodeProps } from 'reactflow';
import { DatabaseIcon } from 'lucide-react';
import { DatabaseDialog } from './DatabaseDialog';
import { BaseNode } from '../../(workflows)/(components)/nodes/BaseNode';
import { NodeData } from '../../(workflows)/(components)/yaml/types';

export function DatabaseNode({ data, ...props }: NodeProps<NodeData>) {
  return (
    <BaseNode
      {...props}
      data={data}
      Dialog={DatabaseDialog}
      Icon={DatabaseIcon}
    />
  );
} 