import { Repeat } from 'lucide-react';
import { IteratorNode } from './IteratorNode';
import { NodeDefinition } from '../types';
import { IteratorToolbar } from './IteratorToolbar';
import { v4 as uuid } from 'uuid';

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
      name: 'item',
      outputs: [
        {
          name: 'item',
          type: 'any',
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