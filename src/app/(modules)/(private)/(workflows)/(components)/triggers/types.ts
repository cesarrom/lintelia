import { LucideIcon } from "lucide-react";
import { ComponentType } from "react";

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