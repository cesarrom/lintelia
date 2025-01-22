import { Table2 } from 'lucide-react';
import { NodeDefinition } from '../types';
import { DecisionTableNode } from './DecisionTableNode';
import { DecisionTableToolbar } from './DecisionTableToolbar';

export const decisionTableNode: NodeDefinition = {
  get id() {
    return crypto.randomUUID();
  },
  type: 'decision-table',
  name: 'Decision Table',
  description: 'Decision Table',
  icon: Table2,
  inputs: [],
  events: [
    {
      name: 'result',
      outputs: [],
    }
  ],
  node: DecisionTableNode,
  toolbar: DecisionTableToolbar,
}; 