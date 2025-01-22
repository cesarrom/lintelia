'use client';

import { NodeProps } from 'reactflow';
import { FormInput } from 'lucide-react';
import { FormDialog } from './FormDialog';
import { FormNodeData } from './types';
import { NodeData } from '../types';
import { BaseNode } from '../BaseNode';

export function FormNode({ data, ...props }: NodeProps<NodeData>) {
  const formData = data.config?.form as FormNodeData | undefined;

  return (
    <>
      <BaseNode
        {...props}
        data={data}
        Dialog={FormDialog}
        Icon={FormInput}
      >
        {formData?.fields && formData.fields.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {formData.fields.length} field(s)
          </div>
        )}
      </BaseNode>
    </>
  );
} 