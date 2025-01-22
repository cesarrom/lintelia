import { GitBranch } from 'lucide-react';
import { NodeDefinition } from '../types';
import { WorkflowNode } from './WorkflowNode';
import { WorkflowToolbar } from './WorkflowToolbar';

export const workflowNode: NodeDefinition = {
  get id() {
    return crypto.randomUUID();
  },
  type: 'workflow',
  name: 'Workflow',
  description: 'Workflow',
  icon: GitBranch,
  inputs: [],
  events: [],
  node: WorkflowNode,
  toolbar: WorkflowToolbar,
}; 