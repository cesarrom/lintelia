'use client';

import { NodeProps } from 'reactflow';
import { StopCircleIcon } from 'lucide-react';
import { BaseNode } from '../../../(workflows)/(components)/nodes/BaseNode';
import { NodeData } from '../../../(workflows)/(components)/yaml/types';
import { useNodeData } from '../../../(workflows)/(components)/WorkflowContext';
import { EndNodeConfigDialog } from './EndNodeConfigDialog';

export function EndNode({ ...props }: NodeProps<NodeData>) {
  const [data] = useNodeData();

  return (
    <BaseNode
      {...props}
      Icon={StopCircleIcon}
      Dialog={EndNodeConfigDialog}
    >
      {data?.exports && Array.isArray(data.exports) && data.exports.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">Exports:</p>
          <ul className="list-disc list-inside">
            {data.exports.map(({ event, outputs }, index: number) => (
              <li key={index}>
                <p className="font-medium">{event}</p>
                <ul className="list-disc list-inside ml-4">
                  {outputs.map((output, outputIndex) => (
                    <li key={outputIndex}>
                      {output.name}: {output.value}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BaseNode>
  );
} 