import { z } from 'zod';

export const DecisionTableNodeDataSchema = z.object({
  xml: z.string(),
  targetDmnId: z.string(),
  outputName: z.string(),
  ctx: z.record(z.string(), z.unknown())
});

export type DecisionTableNodeData = z.infer<typeof DecisionTableNodeDataSchema>;

export const events = {
  success: 'success',
} as const;

export type DecisionTableEvent = (typeof events)[keyof typeof events];