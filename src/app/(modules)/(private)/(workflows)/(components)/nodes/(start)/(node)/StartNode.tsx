'use client';

import { NodeProps } from 'reactflow';
import { PlayIcon } from 'lucide-react';
import { BaseNode } from '../../BaseNode';
import { NodeData } from '../../../yaml/types';

export function StartNode({ data, ...props }: NodeProps<NodeData>) {

  return (
    <BaseNode
      {...props}
      data={data}
      noInput
      Icon={PlayIcon}
      
    ></BaseNode>
  );
} 