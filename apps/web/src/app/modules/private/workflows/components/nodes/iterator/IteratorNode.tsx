'use client';

import { NodeProps } from 'reactflow';
import { Repeat } from 'lucide-react';
import { IteratorDialog } from './IteratorDialog';
import { NodeData } from '@repo/fintivio/schemas';
import { BaseNode } from '../BaseNode';

export function IteratorNode({ ...props }: NodeProps<NodeData>) {
  return (
    <BaseNode
      {...props}
      Dialog={IteratorDialog}
      Icon={Repeat}
    />
  );
} 