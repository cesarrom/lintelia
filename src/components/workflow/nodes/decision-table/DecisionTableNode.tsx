'use client';

import { NodeProps } from 'reactflow';
import { Table2 } from 'lucide-react';
import { DecisionTableDialog } from './DecisionTableDialog';
import { NodeData } from '../types';
import { BaseNode } from '../BaseNode';

export function DecisionTableNode(props: NodeProps<NodeData>) {
  return (
    <BaseNode
      {...props}
      Dialog={DecisionTableDialog}
      Icon={Table2}
    />
  );
} 