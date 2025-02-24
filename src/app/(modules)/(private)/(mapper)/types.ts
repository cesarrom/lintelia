import { z } from 'zod';

export const MapperNodeDataSchema = z.object({
  ctx: z.unknown(),
  propertyPath: z.string()
});
export type MapperNodeData = z.infer<typeof MapperNodeDataSchema>;

export const events = {
  mapped: 'mapped'
} as const;
