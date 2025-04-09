'use client';

import { NodeProps } from 'reactflow';
import { FileCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { IdentityValidationDialog } from './IdentityValidationDialog';
import { IdentityValidationNodeData } from '../types';
import { BaseNode } from '../../BaseNode';
import { NodeData } from '../../../yaml/types';

export function IdentityValidationNode({ data, ...props }: NodeProps<NodeData>) {
  const identityData = data.config as IdentityValidationNodeData | undefined;

  return (
    <BaseNode
      {...props}
      data={data}
      Dialog={IdentityValidationDialog}
      Icon={FileCheck}
    />
  );
} 