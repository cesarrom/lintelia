'use client';

import { NodeProps } from 'reactflow';
import { Fingerprint } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProofOfLifeDialog } from './ProofOfLifeDialog';
import { BaseNode } from '../../(workflows)/(components)/nodes/BaseNode';
import { NodeData } from '../../(workflows)/(components)/yaml/types';
import { ProofOfLifeNodeData } from '../types';

export function ProofOfLifeNode({ data, ...props }: NodeProps<NodeData>) {
  const proofOfLifeData = data.config as ProofOfLifeNodeData | undefined;

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