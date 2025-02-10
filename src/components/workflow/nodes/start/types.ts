import { z } from 'zod';

export const startNodeSchema = z.never();

export type StartNodeData = z.infer<typeof startNodeSchema>;