'use client';

import { NodeProps } from 'reactflow';
import { ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WizardDialog } from './WizardDialog';
import { WizardNodeData } from './types';
import { NodeData } from '../types';
import { BaseNode } from '../BaseNode';

export function WizardNode({ ...props }: NodeProps<NodeData>) {
  const config = props.data.config as unknown as WizardNodeData;

  return (
    <BaseNode
      {...props}
      Dialog={WizardDialog}
      Icon={ListChecks}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Steps:</span>
        <Badge variant="secondary">{config.steps.length}</Badge>
      </div>
      {config.settings?.allowStepNavigation && (
        <Badge variant="outline">Navigation Enabled</Badge>
      )}
      {config.settings?.saveProgress && (
        <Badge variant="outline">Progress Saved</Badge>
      )}
    </BaseNode>
  );
} 