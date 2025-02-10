import { Play } from 'lucide-react';
import { StartNode } from './StartNode';
import { NodeDefinition } from '../types';
import React from 'react';
import { v4 as uuid } from 'uuid';

export const startNode: NodeDefinition = {
  get id() {
    return uuid();
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
      trigger: {
        type: 'webhook',
        config: {},
      },
    },
  },
  events: [
    {
      name: 'started',
      outputs: [],
    }
  ],
}; 