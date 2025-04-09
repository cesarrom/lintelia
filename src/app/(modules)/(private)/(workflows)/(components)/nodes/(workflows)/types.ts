import { z } from 'zod';

export const workflowNodeDataSchema = z.object({
  workflowId: z.string(),
  inputMap: z.record(z.string(), z.string())
});

export type WorkflowNodeData = z.infer<typeof workflowNodeDataSchema>;

export const events = {
  done: 'started'
} as const;