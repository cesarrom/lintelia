import { Repeat } from 'lucide-react';
import { IteratorNode } from './IteratorNode';
import { IteratorToolbar } from './IteratorToolbar';
import { v4 as uuid } from 'uuid';
import { WORKFLOW_EVENTS } from '@repo/fintivio/schemas';
import { NodeDefinition } from '../types';

export const iteratorNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'iterator',
  name: 'Iterator',
  description: 'Iterator',
  icon: Repeat,
  node: IteratorNode,
  toolbar: IteratorToolbar,
  events: [
    {
      name: WORKFLOW_EVENTS.iterator.item,
      outputs: [
        {
          name: 'item',
          type: 'object',
        }
      ]
    }
  ],
  initialConfig: {
    name: 'Iterator',
    config: {
      iterator: {
        name: 'Iterator',
        description: '',
        config: {
          arrayPath: '',
          itemVariable: 'item',
          indexVariable: 'index',
        },
      },
    },
  },
}; 