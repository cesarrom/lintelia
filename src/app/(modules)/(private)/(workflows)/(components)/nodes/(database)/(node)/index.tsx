import { DatabaseNode } from './DatabaseNode';
import { DatabaseToolbar } from './DatabaseToolbar';
import { v4 as uuid } from 'uuid';;
import { Database } from 'lucide-react';
import { NodeDefinition } from '../../types';

export const databaseNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  toolbar: DatabaseToolbar,
  node: DatabaseNode,
  icon: Database,
  type: 'database',
  name: 'Database',
  description: 'Database',
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
};