import { Square } from 'lucide-react';
import { EndNode } from './EndNode';
import { NodeDefinition } from '../types';
import React from 'react';

export const endNode: NodeDefinition = {
  get id() {
    return crypto.randomUUID();
  },
  type: 'end',
  name: 'End',
  icon: Square,
  node: EndNode,
  toolbar: React.Fragment,
  description: 'End',
  inputs: [],
  events: [],
  initialConfig: {
    end: {
      name: 'End',
      description: '',
      outputs: [],
    },
  },
};