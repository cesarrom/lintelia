import { NodeDefinition } from '../types';
import { MapperNode } from './MapperNode';
import { MapperToolbar } from './MapperToolbar';
import { ArrowRightLeft } from 'lucide-react';

export const mapperNode: NodeDefinition = {
  get id() {
    return crypto.randomUUID();
  },
  type: 'mapper',
  name: 'Mapper',
  description: 'Mapper',
  icon: ArrowRightLeft,
  node: MapperNode,
  toolbar: MapperToolbar,
  inputs: [],
  events: [],
}; 