import { GitBranchPlus } from 'lucide-react';
import { ConditionalNode } from './ConditionalNode';
import { NodeDefinition } from '../types';
import { ConditionalToolbar } from './ConditionalToolbar';

export const conditionalNode: NodeDefinition = {
  get id() {
    return crypto.randomUUID();
  },
  type: 'conditional',
  name: 'Condition',
  description: 'Condition',
  icon: GitBranchPlus,
  inputs: [],
  events: [
    {
      name: 'true',
      outputs: []
    },
    {
      name: 'false',
      outputs: []
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