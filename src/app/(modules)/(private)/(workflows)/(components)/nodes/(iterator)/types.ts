import { z } from 'zod';

export const IteratorNodeDataSchema = z.object({
  // The variable to iterate over
  ctx: z.unknown(),
  // The path to the array to iterate over
  pathToArrayInContext: z.string()
});
export type IteratorNodeData = z.infer<typeof IteratorNodeDataSchema>;

export const events = {
  item: 'item',
  done: 'done'
} as const;
