import { z } from 'zod';

export const FormNodeDataSchema = z.object({
  formId: z.string(),
  variables: z.record(z.string(), z.any()),
  persistent: z.boolean().default(false),
});

export type FormNodeData = z.infer<typeof FormNodeDataSchema>;

export const events = {
  publicUrl: 'public_url',
  success: 'form_submitted'
} as const;
