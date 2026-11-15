'use client';

import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { UserSearch } from 'lucide-react';
import { FetchUserDialog } from './FetchUserDialog';
import { BaseNode } from '../BaseNode';
import { NodeData } from '../../../yaml/types';

function FetchUserNodeComponent({ data, ...props }: NodeProps<NodeData>) {
  return (
    <BaseNode
      {...props}
      data={data}
      Dialog={FetchUserDialog}
      Icon={UserSearch}
    />
  );
}

export const FetchUserNode = memo(FetchUserNodeComponent); 