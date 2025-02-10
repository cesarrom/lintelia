import { z } from 'zod';

export const DecisionTableNodeDataSchema = z.object({
  xml: z.string(),
  targetDmnId: z.string(),
  outputName: z.string()
});
export type DecisionTableNodeData = z.infer<typeof DecisionTableNodeDataSchema>;