import { NodeProps } from 'reactflow';
import { LucideIcon } from 'lucide-react';
import { ComponentType } from "react";
import { NodeData } from '@repo/fintivio/schemas';

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
export interface TriggerConfigProps<T = unknown> {
  onSubmit: (config: T) => void;
  initialConfig?: T;
}

export interface TriggerDefinition<T = unknown> {
  name: string;
  description: string;
  icon: LucideIcon;
  configComponent: ComponentType<TriggerConfigProps<T>>;
  initialConfig: T;
}

export interface TriggerEvent {
  type: string;
  eventName: string;
  payload?: Record<string, unknown>;
} 