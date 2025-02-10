import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, primaryKey } from "drizzle-orm/sqlite-core";

// Roles table
export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  permissions: text('permissions').notNull(), // JSON string of RolePermissions type
  createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => Date.now()),
});

// User Roles table
export const userRoles = sqliteTable('user_roles', {
  userId: text('user_id').references(() => users.id),
  roleId: text('role_id').references(() => roles.id),
});

// Users table (maps to Auth0 users)
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // Auth0 user ID
  email: text('email').notNull().unique(),
  createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => Date.now()),
});


// Invitations table
export const invitations = sqliteTable('invitations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  roleId: text('role_id').references(() => roles.id),
  createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => Date.now()),
});

// Forms table
export const forms = sqliteTable('forms', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  config: text('config').notNull(), // JSON string of FormConfig type
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => Date.now()),
});

// Email Templates table
export const emailTemplates = sqliteTable('email_templates', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  variables: text('variables').notNull(), // JSON string of variable definitions
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => Date.now()),
});

// Workflows table
export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  version: integer('version').notNull().default(1),
  status: text('status', { enum: ['draft', 'active', 'archived'] }).notNull().default('draft'),
  yaml: text('yaml').notNull(), // Store the entire workflow as YAML
  allowedRoles: text('allowed_roles', { mode: 'json' }).$type<string[]>().notNull(), // JSON array of role IDs
  allowedUsers: text('allowed_users', { mode: 'json' }).$type<string[]>().notNull(), // JSON array of user IDs
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => Date.now()),
});

// Workflow Triggers table
export const workflowTriggers = sqliteTable('workflow_triggers', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  workflowId: text('workflow_id').references(() => workflows.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // e.g. 'form', 'api', 'database', 'user', etc.
  eventName: text('event_name').notNull(), // e.g. 'form.submitted', 'user.created', etc.
  config: text('config', { mode: 'json' }).$type<Record<string, unknown>>().notNull(), // JSON string of trigger-specific configuration
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => Date.now()),
});

// Workflow Executions table
export const workflowExecutions = sqliteTable('workflow_executions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  workflowId: text('workflow_id').references(() => workflows.id).notNull(),
  executionNodeId: text('execution_node_id').references(() => workflowNodeExecutions.id),
  status: text('status', { enum: ['pending', 'in_progress', 'completed', 'failed'] }).notNull().default('pending'),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
  executingVersion: integer('executing_version').notNull().default(1),
  triggeredBy: text('triggered_by').references(() => users.id).notNull(),
  triggeredByRole: text('triggered_by_role').references(() => roles.id).notNull(),
  createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  inputs: text('inputs', { mode: 'json' }).$type<Record<string, unknown>>(),
  outputs: text('outputs', { mode: 'json' }).$type<Record<string, unknown>>(),
});

// a node might instantiate a listener to hint when to trigger its own execution, "when this event from this node occurs, trigger my execution"
export const workflowExecutionListeners = sqliteTable('workflow_execution_listeners', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  executionId: text('execution_id').references(() => workflowExecutions.id).notNull(),
  /**
   * the target node that is going to be executed when the event occurs
   */
  listenerNodeId: text('listener_id').notNull(),
  /**
   * the name of the event being emitted
   */
  event: text('event').notNull(),
  /**
   * the source node that is emitting the event, could be anything, usually a node
   */
  sourceId: text('source_id'),
  /**
   * the type of the source node that is emitting the event, could be anything, usually a node
   */
  sourceType: text('source_type', { enum: ['node', 'node_execution'] }).notNull(),
  status: text('status', { enum: ['waiting', 'in_progress', 'completed', 'failed'] }).notNull().default('waiting'),
  createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Workflow Node Executions table
export const workflowNodeExecutions = sqliteTable('workflow_node_executions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  executionId: text('execution_id').references(() => workflowExecutions.id).notNull(),
  nodeId: text('node_id').notNull(),
  status: text('status', { enum: ['pending', 'in_progress', 'completed', 'failed'] }).notNull().default('pending'),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
  executedBy: text('executed_by').references(() => users.id),
  config: text('config', { mode: 'json' }).$type<Record<string, unknown>>().notNull(), // JSON string of node-specific configuration
  executedByRole: text('executed_by_role').references(() => roles.id),
  createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const workflowNodeExecutionsEdges = sqliteTable('workflow_node_executions_edges', {
  executionId: text('execution_id').references(() => workflowNodeExecutions.executionId).notNull(),
  nodeExecutionId: text('node_execution_id').references(() => workflowNodeExecutions.id).notNull(),
  eventName: text('event_name').notNull(),
  result: text('result', { mode: 'json' }).$type<Record<string, unknown>>(), // JSON string of node execution result
  error: text('error'),
  createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, t => ({
  pk: primaryKey({ columns: [t.nodeExecutionId, t.eventName] })
}));
