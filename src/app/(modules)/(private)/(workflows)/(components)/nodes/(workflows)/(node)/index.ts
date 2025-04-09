import { GitBranch } from 'lucide-react';
import { WorkflowNode } from './WorkflowNode';
import { WorkflowToolbar } from './WorkflowToolbar';
import { v4 as uuid } from 'uuid';
import { NodeDefinition } from '../../types';

export const workflowNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'workflow',
  name: 'Workflow',
  description: 'Workflow',
  icon: GitBranch,
  events: [
    {
      name: 'completed',
      outputs: [],
    },
    {
      name: 'failed',
      outputs: [],
    }
  ],
  node: WorkflowNode,
  toolbar: WorkflowToolbar,
}; 