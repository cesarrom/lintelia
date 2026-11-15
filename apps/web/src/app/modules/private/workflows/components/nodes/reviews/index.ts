import { ReviewNode } from './ReviewNode';
import { ClipboardCheck } from 'lucide-react';
import { ReviewToolbar } from './ReviewToolbar';
import { v4 as uuid } from 'uuid';
import { WORKFLOW_EVENTS } from '@repo/fintivio/schemas';
import { NodeDefinition } from '../types';

export const reviewNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'review',
  name: 'Review',
  description: 'Review data and make a decision',
  icon: ClipboardCheck,
  node: ReviewNode,
  toolbar: ReviewToolbar,
  events: [
    {
      name: WORKFLOW_EVENTS.reviews.assigned,
      outputs: [{
        name: 'review',
        type: 'object',
      }]
    },
    {
      name: WORKFLOW_EVENTS.reviews.approved,
      outputs: [{
        name: 'review',
        type: 'object',
      }]
    },
    {
      name: WORKFLOW_EVENTS.reviews.rejected,
      outputs: [{
        name: 'review',
        type: 'object',
      }]
    },
    {
      name: WORKFLOW_EVENTS.reviews.additionalDataRequested,
      outputs: [{
        name: 'review',
        type: 'object',
      }]
    },
    {
      name: WORKFLOW_EVENTS.reviews.timeout,
      outputs: [{
        name: 'review',
        type: 'object',
      }]
    }
  ],
  initialConfig: {
    title: 'Review',
    description: 'Review data and make a decision',
    items: [],
  },
}; 