import { z } from 'zod';

export const WorkflowNodeDataSchema = z.object({
  workflowId: z.string(),
  inputMap: z.record(z.string(), z.string())
});

export type WorkflowNodeData = z.infer<typeof WorkflowNodeDataSchema>;
