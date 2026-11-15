import { v4 as uuid } from 'uuid';
import { DecisionTableNode } from './DecisionTableNode';
import { DecisionTableToolbar } from './DecisionTableToolbar';
import { NodeDefinition } from '../types';
import { Table2 } from 'lucide-react';
import { WORKFLOW_EVENTS } from '@repo/fintivio/schemas';

export const decisionTableNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  toolbar: DecisionTableToolbar,
  node: DecisionTableNode,
  icon: Table2,
  type: 'decisionTable',
  name: 'Decision Table',
  description: 'Decision Table',
  events: [
    {
      name: WORKFLOW_EVENTS.decisionTable.success,
      outputs: [
        {
          name: 'result',
          type: 'number'
        },
        {
          name: 'form_id',
          type: 'string',
        },
        {
          name: 'instance_id',
          type: 'string',
        },
        {
          name: 'answers_id',
          type: 'string',
        }
      ],
    }
  ],
};
