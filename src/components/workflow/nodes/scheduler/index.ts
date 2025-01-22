import { Clock } from 'lucide-react';
import { SchedulerNode } from './SchedulerNode';
import { SchedulerToolbar } from './SchedulerToolbar';
import { NodeDefinition } from '../types';

export const schedulerNode: NodeDefinition = {
  id: crypto.randomUUID(),
  type: 'scheduler',
  name: 'Scheduler',
  description: 'Schedule workflow execution',
  icon: Clock,
  node: SchedulerNode,
  toolbar: SchedulerToolbar,
  inputs: [
    {
      name: 'input',
      type: 'any',
    },
  ],
  events: [
    {
      name: 'output',
      outputs: [
        {
          name: 'output',
          type: 'any',
        },
      ],
    },
  ],
  initialConfig: {
    type: 'relative',
    amount: '1',
    unit: 'hours',
    settings: {
      retryOnFailure: false,
      timezone: 'UTC',
    },
  },
}; 