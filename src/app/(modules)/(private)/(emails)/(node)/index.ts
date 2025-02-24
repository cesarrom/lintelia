import { Mail } from 'lucide-react';
import { EmailNode } from './EmailNode';
import { EmailToolbar } from './EmailToolbar';
import { v4 as uuid } from 'uuid';
import { NodeDefinition } from '../../(workflows)/(components)/nodes/types';

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
    },
    {
      name: 'failed',
      outputs: [],
    }
  ],
  node: EmailNode,
  toolbar: EmailToolbar,
}; 