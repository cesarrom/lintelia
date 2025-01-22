import { ListChecks } from 'lucide-react';
import { WizardNode } from './WizardNode';
import { WizardToolbar } from './WizardToolbar';
import { NodeDefinition } from '../types';

export const wizardNode: NodeDefinition = {
  get id() {
    return crypto.randomUUID();
  },
  type: 'wizard',
  name: 'Wizard',
  description: 'A sequential wizard for user input',
  icon: ListChecks,
  node: WizardNode,
  toolbar: WizardToolbar,
  inputs: [],
  events: [],
  initialConfig: {
    steps: [],
    settings: {
      allowStepNavigation: false,
      saveProgress: false,
      expiryHours: 24,
      theme: 'default',
    },
  },
};