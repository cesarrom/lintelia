import { Mail } from 'lucide-react';
import { NodeDefinition } from '../types';
import { EmailNode } from './EmailNode';
import { EmailToolbar } from './EmailToolbar';

export const emailNode: NodeDefinition = {
  get id() {
    return crypto.randomUUID();
  },
  description: 'Email',
  type: 'email',
  name: 'Email',
  icon: Mail,
  inputs: [],
  events: [
    {
      name: 'sent',
      outputs: [],
    }
  ],
  node: EmailNode,
  toolbar: EmailToolbar,
}; 