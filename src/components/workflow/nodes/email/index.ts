import { Mail } from 'lucide-react';
import { NodeDefinition } from '../types';
import { EmailNode } from './EmailNode';
import { EmailToolbar } from './EmailToolbar';
import { v4 as uuid } from 'uuid';

export const emailNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  description: 'Email',
  type: 'email',
  name: 'Email',
  icon: Mail,
  events: [
    {
      name: 'sent',
      outputs: [],
    }
  ],
  node: EmailNode,
  toolbar: EmailToolbar,
}; 