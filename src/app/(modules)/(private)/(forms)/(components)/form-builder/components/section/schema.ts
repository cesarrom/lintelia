import { z } from 'zod';
import { baseComponentConfigSchema } from '../../schemas';

export const sectionConfigSchema = baseComponentConfigSchema.extend({
  collapsible: z.boolean().default(false),
  defaultCollapsed: z.boolean().default(false),
  showBorder: z.boolean().default(true),
  components: z.array(z.object({
    id: z.string(),
    type: z.string(),
    config: z.record(z.string(), z.unknown()),
  })).default([]),
});

// Section doesn't have input/output as it's a container
export const sectionInputSchema = z.record(z.string(), z.unknown()).optional();
export const sectionOutputSchema = z.record(z.string(), z.unknown()); 