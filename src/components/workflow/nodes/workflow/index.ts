import { GitBranch } from 'lucide-react';
import { NodeDefinition } from '../types';
import { WorkflowNode } from './WorkflowNode';
import { WorkflowToolbar } from './WorkflowToolbar';
import { v4 as uuid } from 'uuid';

export const workflowNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'workflow',
  name: 'Workflow',
  description: 'Workflow',
  icon: GitBranch,
  events: [],
  node: WorkflowNode,
  toolbar: WorkflowToolbar,
}; 