'use client';

import { NodeProps } from 'reactflow';
import { MapperDialog } from './MapperDialog';
import { ArrowRightLeft } from 'lucide-react';
import { BaseNode } from '../../(workflows)/(components)/nodes/BaseNode';
import { NodeData } from '../../(workflows)/(components)/yaml/types';

export function MapperNode(props: NodeProps<NodeData>) {

  return (
    <BaseNode
      {...props}
      Dialog={MapperDialog}
      Icon={ArrowRightLeft}
    />
  );
} 