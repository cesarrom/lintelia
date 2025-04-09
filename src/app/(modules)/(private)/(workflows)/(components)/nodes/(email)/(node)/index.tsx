'use client';

import { EmailNode } from './EmailNode';
import { EmailToolbar } from './EmailToolbar';
import { v4 as uuid } from 'uuid';
import { Mail } from 'lucide-react';
import { NodeDefinition } from '../../types';

export const emailNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  toolbar: EmailToolbar,
  node: EmailNode,
  icon: Mail,
  description: 'Email',
  type: 'email',
  name: 'Email',
  events: [
    {
      name: 'sent',
      outputs: [],
    },
    {
      name: 'failed',
      outputs: [],
    }
  ],
};
