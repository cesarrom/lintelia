import { UserSearch } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { FetchUserNode } from './FetchUserNode';
import { FetchUserToolbar } from './FetchUserToolbar';
import { NodeDefinition } from '../../types';

export const fetchUserNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'fetchUser',
  name: 'Fetch User',
  description: 'Fetch User',
  icon: UserSearch,
  events: [
    {
      name: 'found',
      outputs: [
        {
          name: 'email',
          type: 'string',
        },
        {
          name: 'name',
          type: 'string',
        },
        {
          name: 'picture',
          type: 'string',
        },
        {
          name: 'roles',
          type: 'array',
        },
        {
          name: 'status',
          type: 'string',
        },
        {
          name: 'createdAt',
          type: 'date',
        },
      ]
    },
    {
      name: 'notFound',
      outputs: []
    }
  ],
  node: FetchUserNode,
  toolbar: FetchUserToolbar,
  initialConfig: { },
}; 