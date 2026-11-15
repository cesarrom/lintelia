import { Clock } from 'lucide-react';
import { SchedulerNode } from './SchedulerNode';
import { SchedulerToolbar } from './SchedulerToolbar';
import { v4 as uuid } from 'uuid';
import { WORKFLOW_EVENTS } from '@repo/fintivio/schemas';
import { NodeDefinition } from '../types';

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
      name: WORKFLOW_EVENTS.scheduler.timerStarted,
      outputs: [],
    },
    {
      name: WORKFLOW_EVENTS.scheduler.done,
      outputs: [],
    },
  ],
  initialConfig: {
    type: 'relative',
    amount: 1,
    unit: 'hours',
  },
}; 