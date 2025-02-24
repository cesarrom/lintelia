import { z } from 'zod';

export const DocumentExtractorNodeDataSchema = z.object({
  file: z.string()
});
export type DocumentExtractorNodeData = z.infer<typeof DocumentExtractorNodeDataSchema>;
export const events = {
  success: 'success',
  publicUrl: 'public_url',
} as const;
