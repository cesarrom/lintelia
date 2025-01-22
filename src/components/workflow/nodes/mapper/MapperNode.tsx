'use client';

import { NodeProps } from 'reactflow';
import { MapperDialog } from './MapperDialog';
import { NodeData } from '../types';
import { ArrowRightLeft } from 'lucide-react';
import { BaseNode } from '../BaseNode';

export function MapperNode(props: NodeProps<NodeData>) {

  return (
    <BaseNode
      {...props}
      Dialog={MapperDialog}
      Icon={ArrowRightLeft}
    />
  );
} 