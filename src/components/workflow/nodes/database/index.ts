import { Database } from 'lucide-react';
import { NodeDefinition } from '../types';
import { DatabaseNode } from './DatabaseNode';
import { DatabaseToolbar } from './DatabaseToolbar';

export const databaseNode: NodeDefinition = {
  get id() {
    return crypto.randomUUID();
  },
  type: 'database',
  name: 'Database',
  description: 'Database',
  icon: Database,
  inputs: [],
  events: [
    {
      name: 'onInsert',
      outputs: [],
    },
    {
      name: 'onUpdate',
      outputs: [],
    },
    {
      name: 'onDelete',
      outputs: [],
    },
    {
      name: 'onRead',
      outputs: [],
    },
  ],
  node: DatabaseNode,
  toolbar: DatabaseToolbar,
};