import { GitBranch } from 'lucide-react';
import { WorkflowNode } from './WorkflowNode';
import { WorkflowToolbar } from './WorkflowToolbar';
import { v4 as uuid } from 'uuid';
import { NodeDefinition } from '../types';
import { WORKFLOW_EVENTS } from '@repo/fintivio/schemas';

export const wizardNode : NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'wizard',
  name: 'Wizard',
  description: 'Wizard',
  icon: GitBranch,
  events: [
    {
      name: WORKFLOW_EVENTS.wizard.publicUrl,
      outputs: [
        {
          name: 'url',
          type: 'string',
        }
      ],
    },
    {
      name: WORKFLOW_EVENTS.wizard.stepStarted,
      outputs: [
        {
          name: 'step_id',
          type: 'string',
        }
      ],
    },
    {
      name: WORKFLOW_EVENTS.wizard.stepFinished,
      outputs: [
        {
          name: 'step_id',
          type: 'string',
        }
      ],
    },
    {
      name: WORKFLOW_EVENTS.wizard.end,
      outputs: [],
    },
  ],
  node: WorkflowNode,
  toolbar: WorkflowToolbar,
}; 