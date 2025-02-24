import { z } from 'zod';

// Column definition for table schema
export const ColumnDefinitionSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'date', 'json']),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  defaultValue: z.any().optional()
});
export type ColumnDefinition = z.infer<typeof ColumnDefinitionSchema>;

// Table schema definition
export const TableSchemaSchema = z.object({
  name: z.string().refine(name => !name.startsWith('sys_'), 'Table names cannot start with "sys_"'),
  columns: z.array(ColumnDefinitionSchema)
});
export type TableSchema = z.infer<typeof TableSchemaSchema>;

// Query conditions for read/update/delete operations
export const QueryConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'endsWith', 'in', 'notIn']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.any()), z.null()])
});
export type QueryCondition = z.infer<typeof QueryConditionSchema>;

// Sort configuration
export const SortConfigSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc'])
});
export type SortConfig = z.infer<typeof SortConfigSchema>;

// Base configuration for all operations
const BaseOperationSchema = z.object({
  table: z.string().refine(name => !name.startsWith('sys_'), 'Table names cannot start with "sys_"')
});

// Operation-specific configurations
export const InsertOperationSchema = BaseOperationSchema.extend({
  operation: z.literal('insert'),
  data: z.record(z.any())
});

export const ReadOperationSchema = BaseOperationSchema.extend({
  operation: z.literal('read'),
  conditions: z.array(QueryConditionSchema).optional(),
  sort: z.array(SortConfigSchema).optional(),
  limit: z.number().optional(),
  offset: z.number().optional()
});

export const UpdateOperationSchema = BaseOperationSchema.extend({
  operation: z.literal('update'),
  conditions: z.array(QueryConditionSchema),
  data: z.record(z.any())
});

export const DeleteOperationSchema = BaseOperationSchema.extend({
  operation: z.literal('delete'),
  conditions: z.array(QueryConditionSchema)
});

export const CreateTableOperationSchema = z.object({
  operation: z.literal('create_table'),
  schema: TableSchemaSchema
});

// Combined operation schema
export const DatabaseNodeDataSchema = z.discriminatedUnion('operation', [
  InsertOperationSchema,
  ReadOperationSchema,
  UpdateOperationSchema,
  DeleteOperationSchema,
  CreateTableOperationSchema
]);

export type DatabaseNodeData = z.infer<typeof DatabaseNodeDataSchema>;

export const events = {
  onInsert: 'on_insert',
  onDelete: 'on_delete',
  onRead: 'on_read',
  onUpdate: 'on_update',
  onCreateTable: 'on_create_table'
} as const;

export type DatabaseEvent = (typeof events)[keyof typeof events];

