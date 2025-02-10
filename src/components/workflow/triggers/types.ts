import { LucideIcon } from "lucide-react";
import { ComponentType } from "react";
import { EventContext } from "@/types/schema";

export interface TriggerConfigProps<T = Record<string, unknown>> {
  onSubmit: (config: T) => void;
  initialConfig?: T;
}

export interface TriggerDefinition<T = Record<string, unknown>> {
  name: string;
  description: string;
  icon: LucideIcon;
  configComponent: ComponentType<TriggerConfigProps<T>>;
  initialConfig: T;
  shouldExecute: (context: EventContext, config: T) => Promise<boolean>;
  getEventData: (context: EventContext) => Promise<Record<string, unknown>>;
}

export interface TriggerEvent {
  type: string;
  eventName: string;
  payload?: Record<string, unknown>;
} 