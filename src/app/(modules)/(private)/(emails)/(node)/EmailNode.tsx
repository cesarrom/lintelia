'use client';

import {  NodeProps } from 'reactflow';
import { Mail } from 'lucide-react';
import { EmailDialog } from './EmailDialog';
import { BaseNode } from '../../(workflows)/(components)/nodes/BaseNode';
import { NodeData } from '../../(workflows)/(components)/yaml/types';

export function EmailNode(props: NodeProps<NodeData>) {
  return (
    <BaseNode
      {...props}
      Dialog={EmailDialog}
      Icon={Mail}
    />
  );
} 