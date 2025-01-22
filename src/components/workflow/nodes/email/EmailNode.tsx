'use client';

import {  NodeProps } from 'reactflow';
import { NodeData } from '../types';
import { Mail } from 'lucide-react';
import { EmailDialog } from './EmailDialog';
import { BaseNode } from '../BaseNode';

export function EmailNode(props: NodeProps<NodeData>) {
  return (
    <BaseNode
      {...props}
      Dialog={EmailDialog}
      Icon={Mail}
    />
  );
} 