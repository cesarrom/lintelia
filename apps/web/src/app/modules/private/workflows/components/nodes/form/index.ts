import { FormNode } from './FormNode';
import { FormInput } from 'lucide-react';
import { FormToolbar } from './FormToolbar';
import { v4 as uuid } from 'uuid';
import { NodeDefinition } from '../types';
import { WORKFLOW_EVENTS } from '@repo/fintivio/schemas';

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
      name: WORKFLOW_EVENTS.form.publicUrl,
      outputs: [
        {
          name: 'url',
          type: 'string',
        },
        {
          name: 'form_id',
          type: 'string',
        },
        {
          name: 'instance_id',
          type: 'string',
        },
      ]
    },
    {
      name: WORKFLOW_EVENTS.form.success,
      outputs: [
        {
          name: 'form_id',
          type: 'string',
        },
        {
          name: 'instance_id',
          type: 'string',
        },
        {
          name: 'answers_id',
          type: 'string',
        }
      ]
    }
  ],
  initialConfig: {},
}; 