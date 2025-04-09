'use client';

import { NodeProps } from 'reactflow';
import { FormInput } from 'lucide-react';
import { FormDialog } from './FormDialog';
import { BaseNode } from '../../BaseNode';
import { NodeData } from '../../../yaml/types';

export function FormNode({ data, ...props }: NodeProps<NodeData>) {

  return (
    <>
      <BaseNode
        {...props}
        data={data}
        Dialog={FormDialog}
        Icon={FormInput}
      />
    </>
  );
} 