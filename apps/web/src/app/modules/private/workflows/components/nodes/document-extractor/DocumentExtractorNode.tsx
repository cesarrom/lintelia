'use client';

import { NodeProps } from 'reactflow';
import { IdCardIcon } from 'lucide-react';
import { DocumentExtractorDialog } from './DocumentExtractorDialog';
import { BaseNode } from '../BaseNode';
import { NodeData } from '@repo/fintivio/schemas';

export function DocumentExtractorNode({ data, ...props }: NodeProps<NodeData>) {
  return (
    <BaseNode
      {...props}
      data={data}
      Dialog={DocumentExtractorDialog}
      Icon={IdCardIcon}
    />
  );
} 