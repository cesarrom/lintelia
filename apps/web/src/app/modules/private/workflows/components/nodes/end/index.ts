import { StopCircleIcon } from 'lucide-react';
import { EndNode } from './EndNode';
import { EndNodeToolbar } from './EndNodeToolbar';
import { v4 as uuid } from 'uuid';
import { NodeDefinition } from '../types';

export const endNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'end',
  name: 'End',
  description: 'End',
  icon: StopCircleIcon,
  node: EndNode,
  toolbar: EndNodeToolbar,
  config: {},
  events: [],
}; 