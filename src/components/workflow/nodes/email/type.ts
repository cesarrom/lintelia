import { z } from 'zod';

export const EmailNodeDataSchema = z.object({
  emailTemplateId: z.string(),
  inputs: z.array(
    z.object({
      name: z.string(),
      dataType: z.string(),
      value: z.string()
    })
  )
});
export type EmailNodeData = z.infer<typeof EmailNodeDataSchema>;
