'use client';

import { NodeProps } from 'reactflow';
import { PlayIcon } from 'lucide-react';
import { BaseNode } from '../../../(workflows)/(components)/nodes/BaseNode';
import { NodeData } from '../../../(workflows)/(components)/yaml/types';

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