'use client';

import { NodeProps } from 'reactflow';
import { Table2 } from 'lucide-react';
import { DecisionTableDialog } from './DecisionTableDialog';
import { BaseNode } from '../BaseNode';
import { NodeData } from '@repo/fintivio/schemas';

export function DecisionTableNode(props: NodeProps<NodeData>) {
  return (
    <BaseNode
      {...props}
      Dialog={DecisionTableDialog}
      Icon={Table2}
    />
  );
} 