'use client';

import { NodeProps } from 'reactflow';
import { MapperDialog } from './MapperDialog';
import { ArrowRightLeft } from 'lucide-react';
import { BaseNode } from '../BaseNode';
import { NodeData } from '@repo/fintivio/schemas';

export function MapperNode(props: NodeProps<NodeData>) {

  return (
    <BaseNode
      {...props}
      Dialog={MapperDialog}
      Icon={ArrowRightLeft}
    />
  );
} 