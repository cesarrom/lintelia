CREATE TABLE "access_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"kind" varchar(48) NOT NULL,
	"summary" text NOT NULL,
	"payload" jsonb NOT NULL,
	"diff" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"grants" boolean DEFAULT false NOT NULL,
	"status" varchar(24) NOT NULL,
	"requested_by_id" uuid,
	"requested_by_email" varchar(320),
	"requested_by_type" varchar(16) DEFAULT 'member' NOT NULL,
	"effective_at" timestamp with time zone,
	"approved_by_id" uuid,
	"approved_by_email" varchar(320),
	"decided_at" timestamp with time zone,
	"decision_reason" text,
	"applied_at" timestamp with time zone,
	"error" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_changes_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "access_changes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "custom_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"key" varchar(80) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1024) DEFAULT '' NOT NULL,
	"category" varchar(80) DEFAULT 'Custom' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by_email" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_permissions_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "custom_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "member_attribute_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"key" varchar(48) NOT NULL,
	"label" varchar(255) NOT NULL,
	"type" varchar(16) DEFAULT 'text' NOT NULL,
	"options" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" varchar(16) DEFAULT 'manual' NOT NULL,
	"sso_claim" varchar(512),
	"scim_attribute" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_attribute_definitions_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "member_attribute_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "role_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"group_name" varchar(255) NOT NULL,
	"role_id" uuid NOT NULL,
	"created_by_email" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_mappings_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "role_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "source" varchar(16) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "groups" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "granted_by_email" varchar(320);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "idp_groups" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD COLUMN "access" jsonb;--> statement-breakpoint
ALTER TABLE "tenant_security_policies" ADD COLUMN "access_approval" varchar(16) DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_security_policies" ADD COLUMN "access_notify" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_sso_settings" ADD COLUMN "role_source" varchar(16) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "access_changes" ADD CONSTRAINT "access_changes_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_permissions" ADD CONSTRAINT "custom_permissions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_attribute_definitions" ADD CONSTRAINT "member_attribute_definitions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_mappings" ADD CONSTRAINT "role_mappings_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_mappings" ADD CONSTRAINT "role_mappings_role_fk" FOREIGN KEY ("tenant_id","role_id") REFERENCES "public"."roles"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_changes_status_idx" ON "access_changes" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_permissions_tenant_key_idx" ON "custom_permissions" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "member_attribute_definitions_key_idx" ON "member_attribute_definitions" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "role_mappings_group_role_idx" ON "role_mappings" USING btree ("tenant_id",lower("group_name"),"role_id");--> statement-breakpoint
CREATE POLICY "access_changes_tenant_isolation" ON "access_changes" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "custom_permissions_tenant_isolation" ON "custom_permissions" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "member_attribute_definitions_tenant_isolation" ON "member_attribute_definitions" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "role_mappings_tenant_isolation" ON "role_mappings" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "access_changes", "custom_permissions", "member_attribute_definitions", "role_mappings" TO lintelia_app;
--> statement-breakpoint
ALTER TABLE "access_changes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "custom_permissions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "member_attribute_definitions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "role_mappings" FORCE ROW LEVEL SECURITY;
