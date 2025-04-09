import { v4 as uuid } from 'uuid';
import { ConditionalNode } from './ConditionalNode';
import { ConditionalToolbar } from './ConditionalToolbar';
import { NodeDefinition } from '../../types';
import { GitBranchPlus } from 'lucide-react';

export const conditionalNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'conditional',
  name: 'Condition',
  description: 'Condition',
  toolbar: ConditionalToolbar,
  icon: GitBranchPlus,
  node: ConditionalNode,
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
  ]
};