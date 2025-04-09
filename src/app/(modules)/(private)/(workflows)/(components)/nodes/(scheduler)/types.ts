import { z } from 'zod';

export const TimeUnitSchema = z.enum(['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years']);
export type TimeUnit = z.infer<typeof TimeUnitSchema>;

export const SchedulerNodeDataSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('absolute'),
    scheduledDate: z.string()
  }),
  z.object({
    type: z.literal('relative'),
    amount: z.number(),
    unit: TimeUnitSchema
  }),
]);
export type SchedulerNodeData = z.infer<typeof SchedulerNodeDataSchema>;

export const events = {
  done: 'done'
} as const;