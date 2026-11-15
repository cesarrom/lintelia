'use client';

import { NodeProps } from 'reactflow';
import { Fingerprint } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProofOfLifeDialog } from './ProofOfLifeDialog';
import { NodeData, ProofOfLifeNodeConfig } from '@repo/fintivio/schemas';
import { BaseNode } from '../BaseNode';

export function ProofOfLifeNode({ data, ...props }: NodeProps<NodeData>) {
  const proofOfLifeData = data.config as ProofOfLifeNodeConfig | undefined;

  return (
    <BaseNode
      {...props}
      data={data}
      Dialog={ProofOfLifeDialog}
      Icon={Fingerprint}
    >
      {proofOfLifeData?.verificationSteps && (
        <div className="flex flex-wrap gap-1 mt-2">
          {proofOfLifeData.verificationSteps.map((step, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {step.type}
            </Badge>
          ))}
        </div>
      )}
    </BaseNode>
  );
} 