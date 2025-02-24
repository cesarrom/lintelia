import { FormNode } from './FormNode';
import { FormInput } from 'lucide-react';
import { NodeDefinition } from '../types';
import { FormToolbar } from './FormToolbar';
import { v4 as uuid } from 'uuid';

export const formNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'form',
  name: 'Form',
  description: 'Form',
  icon: FormInput,
  node: FormNode,
  toolbar: FormToolbar,
  events: [
    {
      name: 'public_url',
      outputs: [{
        name: 'url',
        type: 'string',
      }]
    },
    {
      name: 'form_submitted',
      outputs: [{
        name: 'form_data',
        type: 'object',
      }]
    }
  ],
  initialConfig: {},
}; 