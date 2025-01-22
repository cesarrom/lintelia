export interface EndNodeData {
  name: string;
  description?: string;
  outputs: Array<{
    id: string;
    name: string;
    type: string;
    description?: string;
  }>;
} 