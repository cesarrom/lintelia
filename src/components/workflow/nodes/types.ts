import { NodeProps } from 'reactflow';
import { LucideIcon } from 'lucide-react';

export interface Port {
  name: string;
  type: string;
}

export interface Event {
  name: string;
  outputs: Port[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  inputs: Port[];
  outputs: Port[];
}

export interface NodeData {
  /**
   * ID from the database
   */
  id: string;
  /**
   * node type, associated to specific UI and specific logic
   */
  type: string;
  /**
   * special field for referencing this node from other nodes within the same workflow
   */
  name: string;
  /**
   * this field is for UX purposes, to describe the node
   */
  description: string;
  /**
   * what the node needs to work
   */
  inputs: Port[];
  /**
   * events that the node can trigger and that could connect to other nodes, each event defines its own outputs which will be passed to the next node in execution
   */
  events: Event[];
  /**
   * configuration for the node, this is used to configure the node with specific settings
   */
  config?: Record<string, unknown>;
}

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