import { DatabaseNode } from './DatabaseNode';
import { DatabaseToolbar } from './DatabaseToolbar';
import { v4 as uuid } from 'uuid';;
import { Database } from 'lucide-react';
import { NodeDefinition } from '../types';
import { WORKFLOW_EVENTS } from '@repo/fintivio/schemas';

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
      name: WORKFLOW_EVENTS.database.onCreateTable,
      outputs: [],
    },
    {
      name: WORKFLOW_EVENTS.database.onInsert,
      outputs: [],
    },
    {
      name: WORKFLOW_EVENTS.database.onUpdate,
      outputs: [],
    },
    {
      name: WORKFLOW_EVENTS.database.onDelete,
      outputs: [],
    },
    {
      name: WORKFLOW_EVENTS.database.onRead,
      outputs: [],
    },
  ],
};