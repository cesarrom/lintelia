import { GitBranchPlus } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { ConditionalNode } from './ConditionalNode';
import { NodeDefinition } from '../types';
import { ConditionalToolbar } from './ConditionalToolbar';

export const conditionalNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'conditional',
  name: 'Condition',
  description: 'Condition',
  icon: GitBranchPlus,
  events: [
    {
      name: 'true',
      outputs: [
        {
          name: 'result',
          type: 'boolean',
        }
      ]
    },
    {
      name: 'false',
      outputs: [
        {
          name: 'result',
          type: 'boolean',
        }
      ]
    }
  ],
  node: ConditionalNode,
  toolbar: ConditionalToolbar,
  initialConfig: {
    name: 'Condition',
    description: '',
    condition: {
      field: '',
      operator: 'equals',
      value: '',
    },
  },
}; 