import { WORKFLOW_EVENTS } from '@repo/fintivio/schemas';
import { MapperNode } from './MapperNode';
import { MapperToolbar } from './MapperToolbar';
import { ArrowRightLeft } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { NodeDefinition } from '../types';

export const mapperNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'mapper',
  name: 'Mapper',
  description: 'Mapper',
  icon: ArrowRightLeft,
  node: MapperNode,
  toolbar: MapperToolbar,
  events: [
    {
      name: WORKFLOW_EVENTS.mapper.mapped,
      outputs: [],
    }
  ],
}; 