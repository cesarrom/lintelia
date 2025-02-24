import { Table2 } from 'lucide-react';
import { NodeDefinition } from '../types';
import { DecisionTableNode } from './DecisionTableNode';
import { DecisionTableToolbar } from './DecisionTableToolbar';
import { v4 as uuid } from 'uuid';

export const decisionTableNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'decisionTable',
  name: 'Decision Table',
  description: 'Decision Table',
  icon: Table2,
  events: [
    {
      name: 'result',
      outputs: [],
    }
  ],
  node: DecisionTableNode,
  toolbar: DecisionTableToolbar,
}; 