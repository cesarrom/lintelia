import { Fingerprint } from 'lucide-react';
import { ProofOfLifeNode } from './ProofOfLifeNode';
import { ProofOfLifeToolbar } from './ProofOfLifeToolbar';
import { NodeDefinition } from '../types';
import { v4 as uuid } from 'uuid';

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
  events: [],
}; 