import { FormNode } from './FormNode';
import { FormInput } from 'lucide-react';
import { NodeDefinition } from '../types';
import { FormToolbar } from './FormToolbar';

export const formNode: NodeDefinition = {
  get id() {
    return crypto.randomUUID();
  },
  type: 'form',
  name: 'Form',
  description: 'Form',
  icon: FormInput,
  node: FormNode,
  toolbar: FormToolbar,
  inputs: [],
  events: [
    {
      name: 'url_available',
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