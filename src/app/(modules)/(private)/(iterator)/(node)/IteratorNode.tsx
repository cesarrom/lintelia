'use client';

import { NodeProps } from 'reactflow';
import { Repeat } from 'lucide-react';
import { IteratorDialog } from './IteratorDialog';
import { BaseNode } from '../../(workflows)/(components)/nodes/BaseNode';
import { NodeData } from '../../(workflows)/(components)/yaml/types';

export function IteratorNode({ ...props }: NodeProps<NodeData>) {
  return (
    <BaseNode
      {...props}
      Dialog={IteratorDialog}
      Icon={Repeat}
    />
  );
} 