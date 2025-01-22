import { z } from 'zod';

export type TriggerType = 'webhook' | 'schedule' | 'event';

export const triggerConfigSchema = z.object({
  type: z.enum(['webhook', 'schedule', 'event']),
  config: z.record(z.unknown()),
});

export type TriggerConfig = z.infer<typeof triggerConfigSchema>;

export interface StartNodeData {
  name: string;
  description?: string;
  inputs: Array<{
    id: string;
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
  trigger: TriggerConfig;
} 