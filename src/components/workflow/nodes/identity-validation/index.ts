import { FileCheck } from 'lucide-react';
import { IdentityValidationNode } from './IdentityValidationNode';
import { IdentityValidationToolbar } from './IdentityValidationToolbar';
import { NodeDefinition } from '../types';
import { v4 as uuid } from 'uuid';

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
          name: 'error_message',
          type: 'string',
        }
      ]
    },
    {
      name: 'validation_completed',
      outputs: [
        {
          name: 'is_valid',
          type: 'boolean',
        }
      ]
    }
  ],
}; 