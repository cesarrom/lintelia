'use client';

import { NodeProps } from 'reactflow';
import { Fingerprint } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProofOfLifeDialog } from './ProofOfLifeDialog';
import { ProofOfLifeNodeData } from './types';
import { NodeData } from '../types';
import { BaseNode } from '../BaseNode';

export function ProofOfLifeNode({ data, ...props }: NodeProps<NodeData>) {
  const proofOfLifeData = data.config?.proofOfLife as ProofOfLifeNodeData | undefined;

  return (
    <BaseNode
      {...props}
      data={data}
      Dialog={ProofOfLifeDialog}
      Icon={Fingerprint}
    >
      {proofOfLifeData?.config.verificationSteps && (
        <div className="flex flex-wrap gap-1 mt-2">
          {proofOfLifeData.config.verificationSteps.map((step, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {step.type}
            </Badge>
          ))}
        </div>
      )}
    </BaseNode>
  );
} 