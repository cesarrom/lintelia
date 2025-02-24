import { z } from 'zod';

// Basic value types that can be used in the workflow
export const ValueTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'object',
  'array',
  'null',
  'any'
]);

export type ValueType = z.infer<typeof ValueTypeSchema>;

// Schema for type definitions
export const TypeDefinitionSchema = z.union([
  ValueTypeSchema,
  z.object({
    type: z.literal('object'),
    properties: z.record(z.lazy(() => TypeDefinitionSchema)),
  }),
  z.object({
    type: z.literal('array'),
    items: z.lazy(() => TypeDefinitionSchema),
  })
]);

export type TypeDefinition = z.infer<typeof TypeDefinitionSchema>;

// Value can be either a raw value or an interpolation expression
export const ValueSchema = z.any();

export type Value = z.infer<typeof ValueSchema>;

// Base types for workflow components
export const PortSchema = z.object({
  name: z.string(),
  type: TypeDefinitionSchema,
  description: z.string().optional()
});

export type Port = z.infer<typeof PortSchema>;

export const EventSchema = z.object({
  name: z.string(),
  outputs: z.array(PortSchema),
  next: z.array(z.string()).optional()  // IDs of the next nodes to trigger when this event occurs
});

export type Event = z.infer<typeof EventSchema>;

// YAML Schema types
export const WorkflowYamlSchema = z.object({
  schemaVersion: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.number(),
  allowedRoles: z.array(z.string()).optional(),
  allowedUsers: z.array(z.string()).optional(),
  triggers: z.array(z.lazy(() => TriggerYamlSchema)),
  inputs: z.array(z.lazy(() => WorkflowInputYamlSchema)),
  steps: z.array(z.lazy(() => StepYamlSchema))
});

export type WorkflowYaml = z.infer<typeof WorkflowYamlSchema>;

export const TriggerYamlSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  description: z.string().optional(),
  config: z.record(z.unknown()),
  eventName: z.string()
});

export type TriggerYaml = z.infer<typeof TriggerYamlSchema>;

export const WorkflowInputYamlSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: TypeDefinitionSchema,
  description: z.string().optional(),
  required: z.boolean()
});

export type WorkflowInputYaml = z.infer<typeof WorkflowInputYamlSchema>;

export const StepExportYamlSchema = z.object({
  event: z.string(),
  outputs: z.array(z.object({
    name: z.string(),
    type: TypeDefinitionSchema,
    value: ValueSchema
  }))
});

export type StepExportYaml = z.infer<typeof StepExportYamlSchema>;

export const StepYamlSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  events: z.array(EventSchema),
  isTerminal: z.boolean().optional(),
  exports: z.array(StepExportYamlSchema).optional()
});

export type StepYaml = z.infer<typeof StepYamlSchema>;

// Runtime types that extend YAML types
export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.number(),
  allowedRoles: z.array(z.string()).optional(),
  allowedUsers: z.array(z.string()).optional(),
  inputs: z.array(WorkflowInputYamlSchema)
});

export type Workflow = z.infer<typeof WorkflowSchema>;

export const NodeDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  events: z.array(EventSchema),
  isTerminal: z.boolean().optional(),
  exports: z.array(StepExportYamlSchema).optional(),
  execute: z.function()
    .args(z.string(), z.object({ variables: z.record(z.unknown()) }))
    .returns(z.promise(z.string()))
    .optional()
});

export type NodeData = z.infer<typeof NodeDataSchema>;

export type NodeExecutor = (executionId: string, { variables }: { variables: Record<string, unknown> }) => Promise<string>;

export type WorkflowTrigger = z.infer<typeof TriggerYamlSchema>;