import { z } from 'zod';

export const FetchUserNodeDataSchema = z.object({
  by: z.enum(['email', 'id']),
  value: z.string()
});

export type FetchUserNodeData = z.infer<typeof FetchUserNodeDataSchema>;

export const events = {
  found: 'found',
  notFound: 'notFound',
} as const;