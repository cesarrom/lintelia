import { z } from 'zod';
import { triggerDefinitionSchema } from './shared.schema.js';

export const outgoingApiNodeConfigSchema = z.object({
  webhookUrl: z.string().url(),
  securityHeader: z.string().optional(),
  securityValue: z.string().optional(),
  method: z.enum(['POST', 'PUT']).default('POST'),
  payload: z.record(z.string(), z.any()).optional()
});

export type OutgoingApiNodeConfig = z.infer<typeof outgoingApiNodeConfigSchema>;

export const incomingApiParamSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["string", "number", "boolean"]),
  required: z.boolean(),
});

export type IncomingApiParam = z.infer<typeof incomingApiParamSchema>;

// Schema for a single header
export const incomingApiHeaderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  value: z.string().min(1, "Value is required"),
});

export type IncomingApiHeader = z.infer<typeof incomingApiHeaderSchema>

export const incomingApiTriggerConfigSchema = z.object({
  apiKeyId: z.string().optional(),
  requiredParams: z.array(incomingApiParamSchema).optional(),
  requiredHeaders: z.array(incomingApiHeaderSchema).optional(),
});

export type IncomingApiTriggerConfig = z.infer<typeof incomingApiTriggerConfigSchema>;


export const comparisonValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null()
]);

export type ComparisonValue = z.infer<typeof comparisonValueSchema>;

export const conditionalNodeConfigSchema = z.object({
  // The type of comparison to perform
  operator: z.enum([
    // Basic equality
    'equals',
    'notEquals',
    // Numeric comparisons
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual',
    // String operations
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'matches', // For regex matching
    // Type checks
    'isNull',
    'isNotNull',
    'isEmpty',
    'isNotEmpty',
    'isTrue',
    'isFalse'
  ]),
  // The value to compare against
  leftValue: comparisonValueSchema.optional(),
  rightValue: comparisonValueSchema
});

export type ConditionalNodeConfig = z.infer<typeof conditionalNodeConfigSchema>;


export const databaseColumnTypes = z.enum(['text', 'integer', 'float', 'double', 'timestamp', 'boolean', 'json', 'jsonb', 'uuid', 'varchar', 'bigint']);

export type DatabaseColumnTypes = z.infer<typeof databaseColumnTypes>;

// Column definition for table schema
export const columnDefinitionSchema = z.object({
  name: z.string(),
  type: databaseColumnTypes,
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  defaultValue: z.any().optional(),
  primary: z.boolean().default(false),
});
export type ColumnDefinition = z.infer<typeof columnDefinitionSchema>;

// Table schema definition
export const tableSchemaSchema = z.object({
  name: z.string().regex(/^(?!sys_).*$/, 'Table names cannot start with "sys_"'),
  columns: z.array(columnDefinitionSchema)
});
export type TableSchema = z.infer<typeof tableSchemaSchema>;

// Query conditions for read/update/delete operations
export const queryConditionSchema = z.string();

export type QueryCondition = z.infer<typeof queryConditionSchema>;

// Sort configuration
export const sortConfigSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc'])
});
export type SortConfig = z.infer<typeof sortConfigSchema>;

// Base configuration for all operations
export const baseOperationSchema = z.object({
  table: z.string().regex(/^(?!sys_).*$/, 'Table names cannot start with "sys_"')
});

// Operation-specific configurations
export const insertOperationSchema = baseOperationSchema.extend({
  operation: z.literal('insert'),
  data: z.record(z.any())
});

export type InsertOperation = z.infer<typeof insertOperationSchema>;

export const readOperationSchema = baseOperationSchema.extend({
  operation: z.literal('read'),
  conditions: queryConditionSchema.optional(),
  sort: z.array(sortConfigSchema).optional(),
  limit: z.number().optional(),
  offset: z.number().optional()
});

export type ReadOperation = z.infer<typeof readOperationSchema>;

export const updateOperationSchema = baseOperationSchema.extend({
  operation: z.literal('update'),
  conditions: queryConditionSchema,
  data: z.record(z.any())
});

export type UpdateOperation = z.infer<typeof updateOperationSchema>;

export const deleteOperationSchema = baseOperationSchema.extend({
  operation: z.literal('delete'),
  conditions: queryConditionSchema
});

export type DeleteOperation = z.infer<typeof deleteOperationSchema>;

export const createTableOperationSchema = z.object({
  operation: z.literal('create_table'),
  schema: tableSchemaSchema
});

export type CreateTableOperation = z.infer<typeof createTableOperationSchema>;

// Combined operation schema
export const databaseNodeConfigSchema = z.discriminatedUnion('operation', [
  insertOperationSchema,
  readOperationSchema,
  updateOperationSchema,
  deleteOperationSchema,
  createTableOperationSchema
]);

export type DatabaseNodeConfig = z.infer<typeof databaseNodeConfigSchema>;


export const databaseTriggerConfigSchema = z.object({
  table: z.string().min(1, "Table is required"),
  events: z.array(z.enum(['insert', 'update', 'delete', 'create_table'])).min(1, "Select at least one event"),
  conditions: queryConditionSchema.optional(),
});

export type DatabaseTriggerConfig = z.infer<typeof databaseTriggerConfigSchema>;

export const decisionTableNodeConfigSchema = z.object({
  xml: z.string(),
  targetDmnId: z.string(),
  outputName: z.string(),
  ctx: z.record(z.string(), z.unknown())
});

export type DecisionTableNodeConfig = z.infer<typeof decisionTableNodeConfigSchema>;

export const documentExtractorNodeConfigSchema = z.object({
  file: z.string()
});
export type DocumentExtractorNodeConfig = z.infer<typeof documentExtractorNodeConfigSchema>;

export const emailNodeConfigSchema = z.object({
  template: z.string(),
  subject: z.string(),
  to: z.string(),
  cc: z.array(z.string()).optional(),
});

export type EmailNodeConfig = z.infer<typeof emailNodeConfigSchema>;

export const fetchUserNodeConfigSchema = z.object({
  by: z.enum(['email', 'id']),
  value: z.string()
});

export type FetchUserNodeConfig = z.infer<typeof fetchUserNodeConfigSchema>;

export const sendSmsNodeConfigSchema = z.object({
  template: z.string(),
  to: z.string(),
});

export type SendSmsNodeConfig = z.infer<typeof sendSmsNodeConfigSchema>;

export const formNodeConfigSchema = z.object({
  formId: z.string(),
  variables: z.record(z.string(), z.any()),
  persistent: z.boolean().default(false),
});

export type FormNodeConfig = z.infer<typeof formNodeConfigSchema>;

export const formTriggerConditionSchema = z.object({
  field: z.string().min(1, "Field is required"),
  operator: z.enum(["eq", "neq", "contains", "startsWith", "endsWith"]),
  value: z.string().min(1, "Value is required"),
});

export type FormTriggerCondition = z.infer<typeof formTriggerConditionSchema>;

export const formsTriggerConfigSchema = z.object({
  formId: z.string().optional(),
  conditions: z.array(formTriggerConditionSchema).optional(),
});

export type FormsTriggerConfig = z.infer<typeof formsTriggerConfigSchema>;

export const documentValidationTypeSchema = z.enum([
  'passport',
  'driving_license',
  'national_insurance_number',
  'social_security_number',
  'tax_identification_number',
  'utility_bill',
  'national_identity_card',
  'visa',
  'polling_card',
  'residence_permit',
  'birth_certificate',
  'bank_statement',
  'change_of_name',
  'tax_document',
  'company_confirmation_statement',
  'company_annual_accounts',
  'company_statement_of_capital',
  'company_change_of_address',
  'company_incorporation',
  'company_change_of_officers',
  'company_change_of_beneficial_owners',
  'unknown',
  'other'
]);

export type DocumentValidationType = z.infer<typeof documentValidationTypeSchema>;

export const identityValidationNodeConfigSchema = z.object({
  documentType: documentValidationTypeSchema,
  selfieFile: z.string(),
  frontFile: z.string(),
  backFile: z.string().optional(),

});
export type IdentityValidationNodeConfig = z.infer<typeof identityValidationNodeConfigSchema>;

export const iteratorNodeConfigSchema = z.object({
  // The variable to iterate over
  ctx: z.unknown(),
  // The path to the array to iterate over
  pathToArrayInContext: z.string()
});
export type IteratorNodeConfig = z.infer<typeof iteratorNodeConfigSchema>;

export const mapperNodeConfigSchema = z.object({
  // The variable to map
  ctx: z.unknown(),
  // The path to the property to output
  propertyPath: z.string()
});

export type MapperNodeConfig = z.infer<typeof mapperNodeConfigSchema>;


export const verificationTypeSchema = z.enum(['selfie', 'video', 'gesture', 'voice']);

export type VerificationType = z.infer<typeof verificationTypeSchema>;

export const verificationStepSchema = z.object({
  type: verificationTypeSchema,
  instructions: z.string().optional(),
  timeLimit: z.number().optional(), // in seconds
  requiredGestures: z.array(z.string()).optional(),
  requiredPhrase: z.string().optional(),
});

export type VerificationStep = z.infer<typeof verificationStepSchema>;

export const proofOfLifeNodeConfigSchema = z.object({
  verificationSteps: z.array(verificationStepSchema),
  minConfidenceScore: z.number().min(0).max(1).optional(), // 0-1
  maxAttempts: z.number().optional(),
  timeoutDuration: z.number().optional(), // in seconds
  attempt: z.number().optional(),
  requireLocation: z.boolean().optional(),
  requireDeviceInfo: z.boolean().optional(),
});

export type ProofOfLifeNodeConfig = z.infer<typeof proofOfLifeNodeConfigSchema>;

// Review item configuration
export const reviewItemConfigSchema = z.object({
  answer_id: z.string(),
  label: z.string().optional(), // Optional as we can get the label from the form
  required: z.boolean().default(true),
  order: z.number().default(0)
});
export type ReviewItemConfig = z.infer<typeof reviewItemConfigSchema>;

// Review node configuration
export const reviewNodeConfigSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  items: z.array(reviewItemConfigSchema),
  assignToRoles: z.array(z.string()).optional(),
  autoApproveOnMatch: z.boolean().optional(),
  matchCriteria: z.record(z.string(), z.any()).optional(),
  timeoutInHours: z.number().optional(),
  notifyOnAssignment: z.boolean().optional(),
  notifyOnCompletion: z.boolean().optional(),
  requireCommentOnReject: z.boolean().optional(),
  requireEvidenceOnReject: z.boolean().optional()
});
export type ReviewNodeConfig = z.infer<typeof reviewNodeConfigSchema>;

// Review item data
export const reviewItemDataSchema = z.object({
  answer_id: z.string(),
  label: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  comments: z.string().optional()
});

export type ReviewItemData = z.infer<typeof reviewItemDataSchema>;

export const schedulerTimeUnitSchema = z.enum(['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years']);

export type SchedulerTimeUnit = z.infer<typeof schedulerTimeUnitSchema>;

export const schedulerTimezonesSchema = z.enum([
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
]);

export type SchedulerTimezone = z.infer<typeof schedulerTimezonesSchema>;

export const schedulerNodeConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('absolute'),
    scheduledDate: z.string(),
    timezone: schedulerTimezonesSchema
  }),
  z.object({
    type: z.literal('relative'),
    amount: z.number(),
    unit: schedulerTimeUnitSchema
  }),
]);

export type SchedulerNodeConfig = z.infer<typeof schedulerNodeConfigSchema>;

export const schedulerTriggerConfigSchema = z.object({
  type: z.literal('absolute'),
  scheduledDate: z.string(),
  timezone: schedulerTimezonesSchema
});

export type SchedulerTriggerConfig = z.infer<typeof schedulerTriggerConfigSchema>;

export const wizardNodeConfigSchema = z.object({
  urls: z.array(z.string())
});

export type WizardNodeConfig = z.infer<typeof wizardNodeConfigSchema>;


export const workflowNodeConfigSchema = z.object({
  workflowId: z.string(),
  inputMap: z.record(z.string(), z.string())
});

export type WorkflowNodeConfig = z.infer<typeof workflowNodeConfigSchema>;


// _____________________________________________



export const basicValueTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'null',
  'json'
]);

export type BasicValueType = z.infer<typeof basicValueTypeSchema>;

export const complexValueTypeSchema = z.enum([
  'object',
  'array',
]);

export type ComplexValueType = z.infer<typeof complexValueTypeSchema>;

export const valueTypeSchema = z.union([
  basicValueTypeSchema,
  complexValueTypeSchema
]);

export type ValueType = z.infer<typeof valueTypeSchema>;

export type BasicType = string | number | boolean | null | Date

export type ArrayType = Array<ArrayType | BasicType | ObjectType>

export type ObjectType = {
  [key: string]: BasicType | ObjectType | ArrayType
}


const basicValueSchema = z.string().or(z.number()).or(z.boolean()).or(z.null()).or(z.date());

export const recursiveValueSchema: z.ZodType<BasicType | ObjectType | ArrayType> = z.lazy(() => z.union([
  basicValueSchema,
  z.array(recursiveValueSchema),
  z.record(z.string(), recursiveValueSchema)
]));

export type RecursiveValue = z.infer<typeof recursiveValueSchema>;

const variableStringSchema = z.string().regex(/${{.+}}$/);

export const workflowValueSchema = recursiveValueSchema.or(variableStringSchema);

export type WorkflowValue = z.infer<typeof workflowValueSchema>;

export type TypeDefinition = { type: string, value: BasicType | ObjectType | ArrayType};
// {{ ... }}

export const typeDefinitionSchema = z.discriminatedUnion('type', [
  z.object({
    type: basicValueTypeSchema,
    value: basicValueTypeSchema.or(variableStringSchema)
  }),
  z.object({
    type: z.literal('object'),
    value: z.record(z.string(), recursiveValueSchema).or(variableStringSchema),
  }),
  z.object({
    type: z.literal('array'),
    value: z.array(recursiveValueSchema).or(variableStringSchema),
  })
]);


// Value can be either a raw value or an interpolation expression
export type Value = z.infer<typeof recursiveValueSchema>;

// Base types for workflow components
export const portSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  type: valueTypeSchema
});

export type Port = z.infer<typeof portSchema>;

export const eventSchema = z.object({
  name: z.string(),
  outputs: z.array(portSchema),
  next: z.array(z.string()).optional()  // IDs of the next nodes to trigger when this event occurs
});

export type Event = z.infer<typeof eventSchema>;

export const stepExportYamlSchema = z.object({
  event: z.string(),
  outputs: z.array(typeDefinitionSchema.and(z.object({
    name: z.string(),
  })))
});

export type StepExportYaml = z.infer<typeof stepExportYamlSchema>;

export const stepYamlSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  events: z.array(eventSchema),
  isTerminal: z.boolean().optional(),
  exports: z.array(stepExportYamlSchema).optional()
});

export type StepYaml = z.infer<typeof stepYamlSchema>;

export const workflowInputYamlSchema = typeDefinitionSchema.and(z.object({
  id: z.string(),
  name: z.string(),
  /** Human label (forms, "start a case" dialogs); defaults to the name. */
  label: z.string().optional(),
  description: z.string().optional(),
  required: z.boolean()
}));


export type WorkflowInputYaml = z.infer<typeof workflowInputYamlSchema>;

// YAML Schema types
export const workflowYamlSchema = z.object({
  id: z.string().optional(),
  schemaVersion: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.number(),
  allowedRoles: z.array(z.string()).optional(),
  allowedUsers: z.array(z.string()).optional(),
  triggers: z.array(triggerDefinitionSchema),
  inputs: z.array(workflowInputYamlSchema),
  steps: z.array(stepYamlSchema),
  /** Platform events that start this workflow (case engine), e.g. `client.flagged`. */
  startOn: z.array(z.string()).optional(),
  /** Title of the cases it creates, e.g. `Loan pre-approval: {{input.fullName}}`. */
  caseTitle: z.string().optional(),
  /** `requests_only`: applicants only see requests addressed to them, never the case (investigations). */
  clientVisibility: z.enum(['full', 'requests_only']).optional(),
  /** Business stages the case moves through (`case.update` with `stage`), shown on the case, the board and to clients. */
  stages: z.array(z.object({ key: z.string(), label: z.string(), clientLabel: z.string().optional(), exit: z.boolean().optional() })).optional(),
  /** A function: other workflows use it as a step (`function:<workflow id>`), with its inputs and `outputs`. */
  function: z.boolean().optional(),
  /** What the case gives back to its caller: name → JSONata evaluated when it ends. */
  outputs: z.record(z.string()).optional(),
  /** Who may start it by hand / by API and who may see its cases (docs/plans/15 §5.3). */
  access: z.object({ start: z.object({ permissions: z.array(z.string()).optional(), roles: z.array(z.string()).optional(), when: z.string().optional() }).optional(), cases: z.object({ permissions: z.array(z.string()).optional(), roles: z.array(z.string()).optional(), when: z.string().optional() }).optional() }).optional(),
});

export type WorkflowYaml = z.infer<typeof workflowYamlSchema>;
export type TriggerYaml = z.infer<typeof triggerDefinitionSchema>;

// Runtime types that extend YAML types
export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.number(),
  allowedRoles: z.array(z.string()).optional(),
  allowedUsers: z.array(z.string()).optional(),
  inputs: z.array(workflowInputYamlSchema),
  startOn: z.array(z.string()).optional(),
  caseTitle: z.string().optional(),
  clientVisibility: z.enum(['full', 'requests_only']).optional(),
  stages: z.array(z.object({ key: z.string(), label: z.string(), clientLabel: z.string().optional(), exit: z.boolean().optional() })).optional(),
  function: z.boolean().optional(),
  outputs: z.record(z.string()).optional(),
  /** Who may start it by hand / by API and who may see its cases (docs/plans/15 §5.3). */
  access: z.object({ start: z.object({ permissions: z.array(z.string()).optional(), roles: z.array(z.string()).optional(), when: z.string().optional() }).optional(), cases: z.object({ permissions: z.array(z.string()).optional(), roles: z.array(z.string()).optional(), when: z.string().optional() }).optional() }).optional(),
});

export type WorkflowSchema = z.infer<typeof WorkflowSchema>;

export const nodeDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  events: z.array(eventSchema),
  isTerminal: z.boolean().optional(),
  exports: z.array(stepExportYamlSchema).optional(),
});

export type NodeData = z.infer<typeof nodeDataSchema>;

export type NodeExecutor = (executionId: string, { variables }: { variables: Record<string, unknown> }) => Promise<string>;

export type WorkflowTriggerSchema = z.infer<typeof triggerDefinitionSchema>;
