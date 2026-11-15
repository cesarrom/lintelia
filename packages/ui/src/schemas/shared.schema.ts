import { z } from 'zod';

export const logLevelSchema = z.enum(['info', 'warning', 'error', 'debug']);
export type LogLevel = z.infer<typeof logLevelSchema>;

export const logCategorySchema = z.enum(['system', 'workflow', 'user', 'form', 'security', 'integration', 'review', 'database']);
export type LogCategory = z.infer<typeof logCategorySchema>;

export const reviewStatusValuesSchema = z.enum(['pending', 'in_progress', 'approved', 'rejected', 'additional_data_requested']);
export type ReviewStatus = z.infer<typeof reviewStatusValuesSchema>;

export const reviewItemSchema = z.object({
  answer_id: z.string(),
  label: z.string().optional(),
  status: reviewStatusValuesSchema,
  comments: z.string().optional(),
})

export type ReviewItem = z.infer<typeof reviewItemSchema>;

export const evidenceItemSchema = z.object({
  type: z.string(),
  url: z.string().url(),
  name: z.string(),
  description: z.string().optional(),
});

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

export const workflowExecutionStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);

export type WorkflowExecutionStatus = z.infer<typeof workflowExecutionStatusSchema>;

export const workflowTriggerStatusSchema = z.enum(['active', 'inactive']);

export type WorkflowTriggerStatus = z.infer<typeof workflowTriggerStatusSchema>;

export const workflowStatusSchema = z.enum(['draft', 'active', 'archived']);

export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;

export const eventContextSchema = z.object({
  log: z.object({
    id: z.string(),
    category: logCategorySchema,
    message: z.string(),
    level: logLevelSchema,
    source: z.string(),
    metadata: z.array(z.object({
      path: z.array(z.string()),
      pattern: z.unknown(),
    })),
  }),
  inputs: z.record(z.unknown()),
});

export type EventContext = z.infer<typeof eventContextSchema>;

export type EventHandler = (context: EventContext) => Promise<void>;

export const triggerActionSchema = z.object({
  type: z.enum(['RESUME', 'INVOKE']),
  workflowId: z.string(),
  nodeId: z.string().optional(),
  inputs: z.record(z.unknown()).optional(),
});

export type TriggerAction = z.infer<typeof triggerActionSchema>;

export const triggerPatternSchema = z.object({
  category: logCategorySchema.optional(),
  message: z.string().optional(),
  level: logLevelSchema.optional(),
  source: z.string().optional(),
  metadata: z.array(z.object({
    path: z.array(z.string()),
    pattern: z.unknown(),
  })).optional(),
});

export type TriggerPattern = z.infer<typeof triggerPatternSchema>;

export const triggerDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  pattern: triggerPatternSchema,
  action: triggerActionSchema,
});

export type TriggerDefinition = z.infer<typeof triggerDefinitionSchema>;