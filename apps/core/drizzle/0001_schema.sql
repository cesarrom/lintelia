CREATE TYPE "public"."platform_user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."form_instance_status" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."log_level" AS ENUM('info', 'warning', 'error', 'debug');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'in_progress', 'approved', 'rejected', 'additional_data_requested');--> statement-breakpoint
CREATE TYPE "public"."system_variable_type" AS ENUM('string', 'number', 'boolean', 'date', 'null', 'json', 'object', 'array');--> statement-breakpoint
CREATE TYPE "public"."workflow_execution_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."workflow_trigger_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."user_kind" AS ENUM('member', 'client');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'disabled');--> statement-breakpoint
CREATE TABLE "platform_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(255) DEFAULT '' NOT NULL,
	"password_hash" varchar(512),
	"status" "platform_user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255) NOT NULL,
	"status" "tenant_status" DEFAULT 'active' NOT NULL,
	"logo_url" varchar(1024) DEFAULT '' NOT NULL,
	"pallette" jsonb NOT NULL,
	"allowed_domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"address_line_1" varchar(255) DEFAULT '' NOT NULL,
	"address_line_2" varchar(255) DEFAULT '' NOT NULL,
	"city" varchar(255) DEFAULT '' NOT NULL,
	"country" varchar(255) DEFAULT '' NOT NULL,
	"state" varchar(255) DEFAULT '' NOT NULL,
	"zip_code" varchar(255) DEFAULT '' NOT NULL,
	"start_working_hour" varchar(255) DEFAULT '09:00' NOT NULL,
	"end_working_hour" varchar(255) DEFAULT '17:00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"variables" jsonb NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sys_email_templates_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_email_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_form_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"form_instance_id" uuid NOT NULL,
	"field_id" varchar NOT NULL,
	"value" jsonb NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sys_form_answers_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_form_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_form_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"answers" jsonb,
	"variables" jsonb,
	"submitted_by" varchar NOT NULL,
	"status" "form_instance_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sys_form_instances_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_form_instances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"config" json NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"variables" jsonb,
	CONSTRAINT "sys_forms_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_forms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"email" varchar NOT NULL,
	"role_id" varchar NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sys_invitations_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_key_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sys_key_values_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_key_values" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"message" varchar(255) NOT NULL,
	"details" text,
	"level" "log_level" DEFAULT 'info' NOT NULL,
	"category" varchar(255) DEFAULT 'system' NOT NULL,
	"source" varchar(255),
	"userId" varchar(255),
	"metadata" jsonb,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledgedBy" varchar,
	"acknowledgedAt" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sys_logs_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"assigned_to" varchar(255),
	"assigned_at" timestamp with time zone,
	"completed_by" varchar(255),
	"completed_at" timestamp with time zone,
	"comments" text,
	"rejection_reason" text,
	"additional_data_request" text,
	"review_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence" jsonb,
	"due_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sys_reviews_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_system_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"pattern" jsonb NOT NULL,
	"action" jsonb NOT NULL,
	"created_by" varchar NOT NULL,
	"workflow_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sys_system_triggers_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_system_triggers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_system_variables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(255) NOT NULL,
	"type" "system_variable_type" NOT NULL,
	"value" jsonb NOT NULL,
	"isProtected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sys_system_variables_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_system_variables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_workflow_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"status" "workflow_execution_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"execution_node_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sys_workflow_executions_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_workflow_executions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_workflow_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" varchar NOT NULL,
	"event_name" varchar NOT NULL,
	"config" text NOT NULL,
	"status" "workflow_trigger_status" DEFAULT 'active' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sys_workflow_triggers_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_workflow_triggers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"description" varchar(255) NOT NULL,
	"yaml" text NOT NULL,
	"allowed_roles" text[],
	"allowed_users" text[],
	"status" "workflow_status" DEFAULT 'draft' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sys_workflows_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_workflows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_document_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"document_url" text NOT NULL,
	"variables" jsonb NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sys_document_templates_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_document_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sys_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"assignee" varchar(255) NOT NULL,
	"target_users" jsonb NOT NULL,
	"name" varchar(255) NOT NULL,
	"document_template_id" uuid NOT NULL,
	"values" jsonb NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sys_documents_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sys_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"key" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1024) DEFAULT '' NOT NULL,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_roles" (
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_pk" PRIMARY KEY("tenant_id","user_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(255) DEFAULT '' NOT NULL,
	"given_name" varchar(255),
	"family_name" varchar(255),
	"picture" varchar(1024),
	"kind" "user_kind" DEFAULT 'member' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"password_hash" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sys_email_templates" ADD CONSTRAINT "sys_email_templates_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_form_answers" ADD CONSTRAINT "sys_form_answers_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_form_answers" ADD CONSTRAINT "sys_form_answers_form_instance_fk" FOREIGN KEY ("tenant_id","form_instance_id") REFERENCES "public"."sys_form_instances"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_form_instances" ADD CONSTRAINT "sys_form_instances_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_form_instances" ADD CONSTRAINT "sys_form_instances_form_fk" FOREIGN KEY ("tenant_id","form_id") REFERENCES "public"."sys_forms"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_forms" ADD CONSTRAINT "sys_forms_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_invitations" ADD CONSTRAINT "sys_invitations_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_key_values" ADD CONSTRAINT "sys_key_values_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_logs" ADD CONSTRAINT "sys_logs_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_reviews" ADD CONSTRAINT "sys_reviews_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_system_triggers" ADD CONSTRAINT "sys_system_triggers_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_system_triggers" ADD CONSTRAINT "sys_system_triggers_workflow_fk" FOREIGN KEY ("tenant_id","workflow_id") REFERENCES "public"."sys_workflows"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_system_variables" ADD CONSTRAINT "sys_system_variables_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_workflow_executions" ADD CONSTRAINT "sys_workflow_executions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_workflow_executions" ADD CONSTRAINT "sys_workflow_executions_workflow_fk" FOREIGN KEY ("tenant_id","workflow_id") REFERENCES "public"."sys_workflows"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_workflow_triggers" ADD CONSTRAINT "sys_workflow_triggers_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_workflow_triggers" ADD CONSTRAINT "sys_workflow_triggers_workflow_fk" FOREIGN KEY ("tenant_id","workflow_id") REFERENCES "public"."sys_workflows"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_workflows" ADD CONSTRAINT "sys_workflows_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_document_templates" ADD CONSTRAINT "sys_document_templates_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_documents" ADD CONSTRAINT "sys_documents_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_documents" ADD CONSTRAINT "sys_documents_template_fk" FOREIGN KEY ("tenant_id","document_template_id") REFERENCES "public"."sys_document_templates"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_fk" FOREIGN KEY ("tenant_id","role_id") REFERENCES "public"."roles"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_users_email_idx" ON "platform_users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_domain_idx" ON "tenants" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "sys_invitations_tenant_email_idx" ON "sys_invitations" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "sys_key_values_tenant_key_idx" ON "sys_key_values" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "sys_logs_tenant_created_at_idx" ON "sys_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sys_system_variables_tenant_name_idx" ON "sys_system_variables" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_tenant_key_idx" ON "roles" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_email_idx" ON "users" USING btree ("tenant_id",lower("email"));--> statement-breakpoint
CREATE POLICY "platform_users_platform_all" ON "platform_users" AS PERMISSIVE FOR ALL TO "lintelia_platform" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "tenants_platform_all" ON "tenants" AS PERMISSIVE FOR ALL TO "lintelia_platform" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "tenants_self_select" ON "tenants" AS PERMISSIVE FOR SELECT TO "lintelia_app" USING ("tenants"."id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenants_self_update" ON "tenants" AS PERMISSIVE FOR UPDATE TO "lintelia_app" USING ("tenants"."id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenants"."id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_email_templates_tenant_isolation" ON "sys_email_templates" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_form_answers_tenant_isolation" ON "sys_form_answers" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_form_instances_tenant_isolation" ON "sys_form_instances" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_forms_tenant_isolation" ON "sys_forms" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_invitations_tenant_isolation" ON "sys_invitations" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_key_values_tenant_isolation" ON "sys_key_values" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_logs_tenant_isolation" ON "sys_logs" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_reviews_tenant_isolation" ON "sys_reviews" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_system_triggers_tenant_isolation" ON "sys_system_triggers" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_system_variables_tenant_isolation" ON "sys_system_variables" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_workflow_executions_tenant_isolation" ON "sys_workflow_executions" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_workflow_triggers_tenant_isolation" ON "sys_workflow_triggers" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_workflows_tenant_isolation" ON "sys_workflows" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_document_templates_tenant_isolation" ON "sys_document_templates" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sys_documents_tenant_isolation" ON "sys_documents" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "roles_tenant_isolation" ON "roles" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "user_roles_tenant_isolation" ON "user_roles" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "users_tenant_isolation" ON "users" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);