'use client';

import {  NodeProps } from 'reactflow';
import { Mail } from 'lucide-react';
import { EmailDialog } from './EmailDialog';
import { BaseNode } from '../../BaseNode';
import { NodeData } from '../../../yaml/types';

export function EmailNode(props: NodeProps<NodeData>) {
  return (
    <BaseNode
      {...props}
      Dialog={EmailDialog}
      Icon={Mail}
    />
  );
} 