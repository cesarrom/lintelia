import { Repeat } from 'lucide-react';
import { IteratorNode } from './IteratorNode';
import { NodeDefinition } from '../types';
import { IteratorToolbar } from './IteratorToolbar';

export const iteratorNode: NodeDefinition = {
  get id() {
    return crypto.randomUUID();
  },
  type: 'iterator',
  name: 'Iterator',
  description: 'Iterator',
  icon: Repeat,
  node: IteratorNode,
  toolbar: IteratorToolbar,
  inputs: [],
  events: [],
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