import { ReviewNode } from './review-node';
import { ClipboardCheck } from 'lucide-react';
import { ReviewToolbar } from './review-toolbar';
import { v4 as uuid } from 'uuid';
import { NodeDefinition } from '../../(workflows)/(components)/nodes/types';
import { events } from '../types';

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
      name: events.assigned,
      outputs: [{
        name: 'review',
        type: 'object',
      }]
    },
    {
      name: events.approved,
      outputs: [{
        name: 'review',
        type: 'object',
      }]
    },
    {
      name: events.rejected,
      outputs: [{
        name: 'review',
        type: 'object',
      }]
    },
    {
      name: events.additionalDataRequested,
      outputs: [{
        name: 'review',
        type: 'object',
      }]
    },
    {
      name: events.timeout,
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