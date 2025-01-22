import { Fingerprint } from 'lucide-react';
import { ProofOfLifeNode } from './ProofOfLifeNode';
import { ProofOfLifeToolbar } from './ProofOfLifeToolbar';
import { NodeDefinition } from '../types';

export const proofOfLifeNode: NodeDefinition = {
  get id() {
    return crypto.randomUUID();
  },
  type: 'proofOfLife',
  name: 'Proof of Life',
  description: 'Verify user identity through various biometric checks',
  icon: Fingerprint,
  node: ProofOfLifeNode,
  toolbar: ProofOfLifeToolbar,
  inputs: [],
  events: [],
}; 