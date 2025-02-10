import { z } from 'zod';

// Basic value types that can be used in the workflow
export const ValueType = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'object',
  'array',
  'null',
  'any'
]);

export type ValueTypeName = z.infer<typeof ValueType>;

// Schema for type definitions
export const TypeDefinition = z.union([
  ValueType,
  z.object({
    type: z.literal('object'),
    properties: z.record(z.lazy(() => TypeDefinition)),
  }),
  z.object({
    type: z.literal('array'),
    items: z.lazy(() => TypeDefinition),
  })
]);

export type TypeDefinitionType = z.infer<typeof TypeDefinition>;

// Value can be either a raw value or an interpolation expression
export type Value = {
  type: TypeDefinitionType;
  value: unknown;
} | {
  type: TypeDefinitionType;
  interpolation: string;  // Expression wrapped in {{...}}
};

// Base types for workflow components
export interface Port {
  name: string;
  type: TypeDefinitionType;
  description?: string;
}

export interface Event {
  name: string;
  outputs: Port[];
  next?: string[];  // IDs of the next nodes to trigger when this event occurs
}

// YAML Schema types
export interface WorkflowYamlSchema {
  schemaVersion: string;
  name: string;
  description: string;
  version: number;
  allowedRoles?: string[];
  allowedUsers?: string[];
  
  triggers: TriggerYamlSchema[];
  inputs: WorkflowInputYamlSchema[];
  steps: StepYamlSchema[];
}

export interface TriggerYamlSchema {
  id: string;
  type: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
}

export interface WorkflowInputYamlSchema {
  id: string;
  name: string;
  type: TypeDefinitionType;
  description?: string;
  required: boolean;
}

export interface StepYamlSchema {
  id: string;
  name: string;
  type: string;
  description?: string;
  config?: Record<string, unknown>;
  events: Event[];
  isTerminal?: boolean;
  exports?: StepExportYamlSchema[];
}

export interface StepExportYamlSchema {
  event: string;
  outputs: {
    name: string;
    type: TypeDefinitionType;
    value: Value;
  }[];
}

// Runtime types that extend YAML types
export interface Workflow extends Omit<WorkflowYamlSchema, 'schemaVersion' | 'triggers' | 'steps'> {
  id: string;
  inputs: WorkflowInputYamlSchema[];
}

export interface NodeData extends Omit<StepYamlSchema, 'events'> {
  events: Event[];
  execute?: NodeExecutor;
}

export type NodeExecutor = (executionId: string, { variables }: { variables: Record<string, unknown> }) => Promise<string>;

export type WorkflowTrigger = TriggerYamlSchema; 