import { pgTable, serial, bigint, varchar, text, timestamp, uuid, integer, foreignKey, jsonb, unique, boolean, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const sysLogsLevelEnum = pgEnum("sys_logs_level_enum", ['info', 'warning', 'error', 'debug'])
export const sysReviewsStatusEnum = pgEnum("sys_reviews_status_enum", ['pending', 'in_progress', 'approved', 'rejected', 'additional_data_requested'])
export const sysSystemVariablesTypeEnum = pgEnum("sys_system_variables_type_enum", ['string', 'number', 'boolean', 'json', 'array'])


export const typeormMigrations = pgTable("typeorm_migrations", {
	id: serial().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	timestamp: bigint({ mode: "number" }).notNull(),
	name: varchar().notNull(),
});

export const sysEmailTemplates = pgTable("sys_email_templates", {
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	subject: varchar().notNull(),
	body: text().notNull(),
	variables: text().notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
});

export const sysWorkflows = pgTable("sys_workflows", {
	name: varchar({ length: 255 }).notNull(),
	yaml: text().notNull(),
	allowedRoles: text("allowed_roles").notNull(),
	allowedUsers: text("allowed_users").notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	version: integer().default(1).notNull(),
	status: varchar().default('draft').notNull(),
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	description: varchar({ length: 255 }).notNull(),
});

export const sysWorkflowExecutions = pgTable("sys_workflow_executions", {
	status: varchar().default('pending').notNull(),
	startedAt: timestamp("started_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	executionNodeId: varchar("execution_node_id"),
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	workflowId: uuid("workflow_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.workflowId],
			foreignColumns: [sysWorkflows.id],
			name: "FK_773c479a4263c84d0bae184e4c3"
		}).onDelete("cascade"),
]);

export const sysWorkflowNodeExecutions = pgTable("sys_workflow_node_executions", {
	nodeId: varchar("node_id").notNull(),
	status: varchar().default('pending').notNull(),
	startedAt: timestamp("started_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	executedBy: varchar("executed_by"),
	executedByRole: varchar("executed_by_role"),
	config: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	previousNodeExecutionId: uuid("previous_node_execution_id"),
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	executionId: uuid("execution_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.executionId],
			foreignColumns: [sysWorkflowExecutions.id],
			name: "FK_1af517374857a24a8c8b2dd3701"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.previousNodeExecutionId],
			foreignColumns: [table.id],
			name: "FK_3ef0a1ca41e6c657745dce19d5f"
		}),
]);

export const sysWorkflowExecutionListeners = pgTable("sys_workflow_execution_listeners", {
	listenerId: varchar("listener_id").notNull(),
	event: varchar().notNull(),
	sourceId: varchar("source_id"),
	sourceType: varchar("source_type").notNull(),
	status: varchar().default('waiting').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	executionId: uuid("execution_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.executionId],
			foreignColumns: [sysWorkflowExecutions.id],
			name: "FK_8e698e5b58dacba796382df3af4"
		}).onDelete("cascade"),
]);

export const sysForms = pgTable("sys_forms", {
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	config: text().notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	variables: jsonb(),
});

export const sysWorkflowTriggers = pgTable("sys_workflow_triggers", {
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	type: varchar().notNull(),
	eventName: varchar("event_name").notNull(),
	config: text().notNull(),
	status: varchar().default('active').notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	workflowId: uuid("workflow_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.workflowId],
			foreignColumns: [sysWorkflows.id],
			name: "FK_679d54169ea3121135664f282f8"
		}).onDelete("cascade"),
]);

export const sysInvitations = pgTable("sys_invitations", {
	email: varchar().notNull(),
	roleId: varchar("role_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	data: text().notNull(),
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
}, (table) => [
	unique("sys_invitations_email_key").on(table.email),
]);

export const sysFormInstances = pgTable("sys_form_instances", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	formId: uuid("form_id").notNull(),
	answers: jsonb().notNull(),
	variables: jsonb().notNull(),
	submittedBy: varchar("submitted_by").notNull(),
	status: varchar().default('draft').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.formId],
			foreignColumns: [sysForms.id],
			name: "FK_b81587c2596ed27630dbaeadefc"
		}),
]);

export const sysFormAnswers = pgTable("sys_form_answers", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	formInstanceId: uuid("form_instance_id").notNull(),
	fieldId: varchar("field_id").notNull(),
	value: jsonb().notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.formInstanceId],
			foreignColumns: [sysFormInstances.id],
			name: "FK_9258634345b0f62d80a2f9e3f49"
		}),
]);

export const sysSystemVariables = pgTable("sys_system_variables", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: varchar({ length: 255 }).notNull(),
	type: sysSystemVariablesTypeEnum().notNull(),
	value: jsonb().notNull(),
	isProtected: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("UQ_219f075b5a747ae20da51d19b03").on(table.name),
]);

export const sysLogs = pgTable("sys_logs", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	message: varchar({ length: 255 }).notNull(),
	details: text(),
	level: sysLogsLevelEnum().default('info').notNull(),
	source: varchar({ length: 255 }),
	userId: varchar({ length: 255 }),
	metadata: jsonb(),
	acknowledged: boolean().default(false).notNull(),
	acknowledgedBy: varchar(),
	acknowledgedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	category: text().default('system').notNull(),
});

export const sysReviews = pgTable("sys_reviews", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	nodeExecutionId: uuid("node_execution_id").notNull(),
	assignedAt: timestamp("assigned_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	reviewItems: jsonb("review_items").default([]).notNull(),
	evidence: jsonb(),
	dueDate: timestamp("due_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	title: varchar().notNull(),
	description: varchar(),
	status: sysReviewsStatusEnum().default('pending').notNull(),
	assignedTo: varchar("assigned_to"),
	completedBy: varchar("completed_by"),
	comments: varchar(),
	rejectionReason: varchar("rejection_reason"),
	additionalDataRequest: varchar("additional_data_request"),
}, (table) => [
	foreignKey({
			columns: [table.nodeExecutionId],
			foreignColumns: [sysWorkflowNodeExecutions.id],
			name: "FK_5ef894e129fa2f27562a7fe2f84"
		}).onDelete("cascade"),
]);

export const sysSystemTriggers = pgTable("sys_system_triggers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	pattern: jsonb().notNull(),
	action: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	createdBy: varchar("created_by").notNull(),
	workflowId: uuid("workflow_id").notNull(),
});

export const sysKeyValues = pgTable("sys_key_values", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	key: varchar({ length: 255 }).notNull(),
	value: text().notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	description: text(),
});

export const sysWorkflowNodeExecutionsEdges = pgTable("sys_workflow_node_executions_edges", {
	executionId: varchar("execution_id").notNull(),
	eventName: varchar("event_name").notNull(),
	result: text(),
	error: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	nodeExecutionId: uuid("node_execution_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.nodeExecutionId],
			foreignColumns: [sysWorkflowNodeExecutions.id],
			name: "FK_491e5ea492a5f7bf237daced2b1"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.eventName, table.nodeExecutionId], name: "sys_workflow_node_executions_edges_pkey"}),
]);
