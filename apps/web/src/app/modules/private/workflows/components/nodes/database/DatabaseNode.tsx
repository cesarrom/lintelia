'use client';

import { NodeProps } from 'reactflow';
import { DatabaseIcon } from 'lucide-react';
import { DatabaseDialog } from './DatabaseDialog';
import { BaseNode } from '../BaseNode';
import { NodeData } from '@repo/fintivio/schemas';

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