import { z } from 'zod';

export const EmailNodeDataSchema = z.object({
  emailTemplateId: z.string(),
  inputs: z.record(z.string(), z.any()),
  to: z.string(),
  cc: z.array(z.string()).optional(),
});
export type EmailNodeData = z.infer<typeof EmailNodeDataSchema>;

export const events = {
  success: 'success',
  failed: 'failed',
} as const;
