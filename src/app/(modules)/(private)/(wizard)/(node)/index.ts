import { GitBranch } from 'lucide-react';
import { WorkflowNode } from './WorkflowNode';
import { WorkflowToolbar } from './WorkflowToolbar';
import { v4 as uuid } from 'uuid';
import { NodeDefinition } from '../../(workflows)/(components)/nodes/types';

export const wizardNode : NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'wizard',
  name: 'Wizard',
  description: 'Wizard',
  icon: GitBranch,
  events: [
    {
      name: 'public_url',
      outputs: [],
    },
    {
      name: 'completed',
      outputs: [],
    },
  ],
  node: WorkflowNode,
  toolbar: WorkflowToolbar,
}; 