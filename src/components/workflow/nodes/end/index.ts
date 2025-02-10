import { Square } from 'lucide-react';
import { EndNode } from './EndNode';
import { NodeDefinition } from '../types';
import React from 'react';
import { v4 as uuid } from 'uuid';

export const endNode: NodeDefinition = {
  get id() {
    return uuid();
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