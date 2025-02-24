'use client';

import { NodeProps } from 'reactflow';
import { IdCardIcon } from 'lucide-react';
import { DocumentExtractorDialog } from './DocumentExtractorDialog';
import { BaseNode } from '../../(workflows)/(components)/nodes/BaseNode';
import { NodeData } from '../../(workflows)/(components)/yaml/types';

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