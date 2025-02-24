import { Database } from 'lucide-react';
import { NodeDefinition } from '../types';
import { DatabaseNode } from './DatabaseNode';
import { DatabaseToolbar } from './DatabaseToolbar';
import { v4 as uuid } from 'uuid';

export const databaseNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'database',
  name: 'Database',
  description: 'Database',
  icon: Database,
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