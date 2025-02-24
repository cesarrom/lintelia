import { z } from 'zod';

export const FormNodeDataSchema = z.object({
  formId: z.string()
});

export type FormNodeData = z.infer<typeof FormNodeDataSchema>;

export const events = {
  publicUrl: 'publicUrl',
  success: 'success'
} as const;
