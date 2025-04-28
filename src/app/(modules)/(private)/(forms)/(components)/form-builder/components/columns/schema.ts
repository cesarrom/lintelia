import { z } from 'zod';
import { formComponentSchema } from '../../schemas';
import { baseConfigSchema } from '../base-schema';

const columnSchema = z.object({
  id: z.string(),
  width: z.number().min(1).max(12).default(6),
  components: z.array(formComponentSchema).default([]),
});

export const columnsConfigSchema = baseConfigSchema.extend({
  type: z.literal('columns'),
  columns: z.array(columnSchema).default([
    { id: '1', width: 6, components: [] },
    { id: '2', width: 6, components: [] },
  ]),
  gap: z.number().min(0).max(8).default(4),
});

export const columnsInputSchema = z.record(z.string(), z.record(z.string(), z.unknown())).optional();
export const columnsOutputSchema = z.record(z.string(), z.record(z.string(), z.unknown())); 