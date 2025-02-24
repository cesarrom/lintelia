import { NodeProps } from 'reactflow';
import { LucideIcon } from 'lucide-react';
import { NodeData } from '../yaml/types';

export type NodeDefinition = NodeData & {
  icon: LucideIcon;
  node: React.ComponentType<NodeProps<NodeData>>;
  toolbar: React.ComponentType;
  initialConfig?: Record<string, unknown>;
};

export type DialogProps = {
  data: NodeData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: NodeData) => void;
}