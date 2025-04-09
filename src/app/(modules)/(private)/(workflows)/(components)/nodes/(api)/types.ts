import { z } from 'zod';

export const ApiNodeDataSchema = z.object({
  webhookUrl: z.string().url(),
  securityHeader: z.string().optional(),
  securityValue: z.string().optional(),
  method: z.enum(['POST', 'PUT']).default('POST'),
  payload: z.record(z.string(), z.any()).optional()
});

export type ApiNodeData = z.infer<typeof ApiNodeDataSchema>;

export const events = {
  success: 'success',
  failed: 'failed'
} as const;
