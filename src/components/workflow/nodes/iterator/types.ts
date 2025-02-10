import { z } from 'zod';

export const IteratorNodeDataSchema = z.object({
  // The path to the array to iterate over
  pathToArrayInContext: z.string()
});
export type IteratorNodeData = z.infer<typeof IteratorNodeDataSchema>;