import { GitBranch } from 'lucide-react';
import { WorkflowNode } from './WorkflowNode';
import { WorkflowToolbar } from './WorkflowToolbar';
import { NodeDefinition } from '../types';
import { nodeData } from './config';
import { merge } from 'lodash';

export const workflowNode: NodeDefinition = merge(nodeData, {
  icon: GitBranch,
  node: WorkflowNode,
  toolbar: WorkflowToolbar,
}); 