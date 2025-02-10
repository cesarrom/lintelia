'use client';

import { NodeProps } from 'reactflow';
import { PlayIcon } from 'lucide-react';
import { NodeData } from '../types';
import { BaseNode } from '../BaseNode';

export function StartNode({ data, ...props }: NodeProps<NodeData>) {
  return (
    <BaseNode
      {...props}
      data={data}
      Icon={PlayIcon}
      noInput
    />
  );
} 