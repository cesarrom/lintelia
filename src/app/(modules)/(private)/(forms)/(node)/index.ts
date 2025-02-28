import { FormNode } from './FormNode';
import { FormInput } from 'lucide-react';
import { FormToolbar } from './FormToolbar';
import { v4 as uuid } from 'uuid';
import { NodeDefinition } from '../../(workflows)/(components)/nodes/types';
import { events } from '../types';

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
      name: events.publicUrl,
      outputs: [{
        name: 'url',
        type: 'string',
      }]
    },
    {
      name: events.success,
      outputs: [{
        name: 'form_data',
        type: 'object',
      }]
    }
  ],
  initialConfig: {},
}; 