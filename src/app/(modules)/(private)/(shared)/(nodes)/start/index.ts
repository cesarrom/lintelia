import { FileCheck } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { StartNode } from './StartNode';
import { NodeDefinition } from '../../../(workflows)/(components)/nodes/types';

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
      name: 'started',
      outputs: [],
    }
  ],
}; 