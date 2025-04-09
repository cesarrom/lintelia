import { FileCheck } from 'lucide-react';
import { IdentityValidationNode } from './IdentityValidationNode';
import { IdentityValidationToolbar } from './IdentityValidationToolbar';
import { v4 as uuid } from 'uuid';
import { NodeDefinition } from '../../types';

export const identityValidationNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'identityValidation',
  name: 'Identity Validation',
  description: 'Validate identity documents and extract information',
  icon: FileCheck,
  node: IdentityValidationNode,
  toolbar: IdentityValidationToolbar,
  events: [
    {
      name: 'validation_started',
      outputs: [],
    },
    {
      name: 'information_error',
      outputs: [
        {
          name: 'reason',
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
        {
          name: 'answer_id',
          type: 'string',
        }
      ]
    },
    {
      name: 'validation_completed',
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
          name: 'answer_id',
          type: 'string',
        }
      ]
    }
  ],
}; 