import { NodeData } from "../../../yaml/types";
import { v4 as uuid } from 'uuid';

export const nodeData: NodeData = {
  get id() {
    return uuid();
  },
  type: 'workflow',
  name: 'Workflow',
  description: 'Workflow',
  events: [
    {
      name: 'completed',
      outputs: [],
    },
    {
      name: 'failed',
      outputs: [],
    }
  ],
}; 