import { Fingerprint } from 'lucide-react';
import { ProofOfLifeNode } from './ProofOfLifeNode';
import { ProofOfLifeToolbar } from './ProofOfLifeToolbar';
import { v4 as uuid } from 'uuid';
import { NodeDefinition } from '../../types';

export const proofOfLifeNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'proofOfLife',
  name: 'Proof of Life',
  description: 'Verify user identity through various biometric checks',
  icon: Fingerprint,
  node: ProofOfLifeNode,
  toolbar: ProofOfLifeToolbar,
  events: [
    {
      name: 'public_url',
      outputs: [{
        name: 'url',
        type: 'string'
      }],
    },
    {
      name: 'verified',
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
      ],
    },
    {
      name: 'failed',
      outputs: [
        {
          name: 'reason',
          type: 'string'
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
          name: 'answers_id',
          type: 'string',
        }
      ],
    }
  ],
}; 