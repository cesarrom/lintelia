import { FileCheck } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { StartNode } from './StartNode';
import { NodeDefinition } from '../types';
import { WORKFLOW_EVENTS } from '@repo/fintivio/schemas';

export const startNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'start',
  name: 'Start',
  description: 'Start a workflow',
  icon: FileCheck,
  node: StartNode,
  toolbar: () => null,
  events: [
    {
      name: WORKFLOW_EVENTS.start.started,
      outputs: [],
    }
  ],
}; 