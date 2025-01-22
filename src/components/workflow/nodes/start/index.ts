import { Play } from 'lucide-react';
import { StartNode } from './StartNode';
import { NodeDefinition } from '../types';
import React from 'react';

export const startNode: NodeDefinition = {
  get id() {
    return crypto.randomUUID();
  },
  type: 'start',
  name: 'Start',
  description: 'Start',
  icon: Play,
  node: StartNode,
  toolbar: React.Fragment,
  initialConfig: {
    start: {
      name: 'Start',
      description: '',
      inputs: [],
      trigger: {
        type: 'webhook',
        config: {},
      },
    },
  },
  inputs: [],
  events: [],
}; 