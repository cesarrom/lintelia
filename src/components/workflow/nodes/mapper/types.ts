import { z } from 'zod';

export const MapperNodeDataSchema = z.object({
  pathToSourceObjectInContext: z.string(),
  propertyPath: z.string()
});
export type MapperNodeData = z.infer<typeof MapperNodeDataSchema>;