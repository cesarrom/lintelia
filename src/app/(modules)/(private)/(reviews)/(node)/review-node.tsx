'use client';

import React from 'react';
import { NodeProps } from 'reactflow';
import { CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReviewNodeConfigDialog } from './review-node-config-dialog';
import { BaseNode } from '../../(workflows)/(components)/nodes/BaseNode';
import { NodeData } from '../../(workflows)/(components)/yaml/types';
import { useNodeConfig } from '../../(workflows)/(components)/WorkflowContext';
import { ReviewNodeData } from '../types';
import { CheckIcon } from 'lucide-react';

export function ReviewNode({ id, data, ...props }: NodeProps<NodeData>) {
  const [config, setConfig] = useNodeConfig<ReviewNodeData>();

  return (
    <BaseNode
      {...props}
      id={id}
      Icon={CheckIcon}
      type="review"
      data={data}
      Dialog={ReviewNodeConfigDialog}
    >
      <CardContent className="p-4">
        {config ? (
          <>
            <CardTitle className="text-sm font-medium mb-1">{config.title}</CardTitle>
            <CardDescription className="text-xs mb-3">{config.description}</CardDescription>

            {config.items && config.items.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium mb-1">Review Items:</p>
                <ul className="text-xs space-y-1">
                  {config.items.map((item, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <span>{item.label || item.answer_id}</span>
                      {item.required && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">Required</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {config.assignToRoles && config.assignToRoles.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Assigned Roles:</p>
                <div className="flex flex-wrap gap-1">
                  {config.assignToRoles.map((role, index) => (
                    <Badge key={index} variant="secondary" className="text-[10px]">{role}</Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Click the settings icon to configure this review node.</p>
        )}
      </CardContent>
    </BaseNode>
  );
} 