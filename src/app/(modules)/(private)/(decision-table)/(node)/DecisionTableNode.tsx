'use client';

import { NodeProps } from 'reactflow';
import { Table2 } from 'lucide-react';
import { DecisionTableDialog } from './DecisionTableDialog';
import { BaseNode } from '../../(workflows)/(components)/nodes/BaseNode';
import { NodeData } from '../../(workflows)/(components)/yaml/types';

export function DecisionTableNode(props: NodeProps<NodeData>) {
  return (
    <BaseNode
      {...props}
      Dialog={DecisionTableDialog}
      Icon={Table2}
    />
  );
} 