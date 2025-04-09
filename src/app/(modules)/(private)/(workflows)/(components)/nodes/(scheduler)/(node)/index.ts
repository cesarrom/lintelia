import { Clock } from 'lucide-react';
import { SchedulerNode } from './SchedulerNode';
import { SchedulerToolbar } from './SchedulerToolbar';
import { v4 as uuid } from 'uuid';
import { NodeDefinition } from '../../types';

export const schedulerNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'scheduler',
  name: 'Scheduler',
  description: 'Schedule workflow execution',
  icon: Clock,
  node: SchedulerNode,
  toolbar: SchedulerToolbar,
  events: [
    {
      name: 'on_timer_start',
      outputs: [],
    },
    {
      name: 'on_timer_end',
      outputs: [],
    },
  ],
  initialConfig: {
    type: 'relative',
    amount: 1,
    unit: 'hours',
  },
}; 