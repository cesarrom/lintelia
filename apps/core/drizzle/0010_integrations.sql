CREATE TABLE "connector_installation_index" (
	"installation_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"connector_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connector_installation_index" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "connector_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector_id" varchar(64) NOT NULL,
	"version" varchar(32) NOT NULL,
	"manifest" jsonb NOT NULL,
	"manifest_hash" varchar(64) NOT NULL,
	"manifest_url" text NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"approved_by" varchar(320),
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connector_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "connectors" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connectors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "case_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"case_id" uuid,
	"party_id" uuid,
	"type" varchar(32) NOT NULL,
	"installation_id" uuid NOT NULL,
	"connector_id" varchar(64) NOT NULL,
	"external_ref" varchar(255) NOT NULL,
	"status" varchar(32) NOT NULL,
	"summary" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_records_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "case_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "connector_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"connector_id" varchar(64) NOT NULL,
	"connector_version" varchar(32) NOT NULL,
	"audience" varchar(16) DEFAULT 'tenant' NOT NULL,
	"owner_id" uuid,
	"display_name" varchar(255) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"granted_scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"config_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_error" text,
	"created_by_email" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connector_installations_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "connector_installations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "client_action" jsonb;--> statement-breakpoint
ALTER TABLE "connector_installation_index" ADD CONSTRAINT "connector_installation_index_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_versions" ADD CONSTRAINT "connector_versions_connector_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_records" ADD CONSTRAINT "case_records_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_records" ADD CONSTRAINT "case_records_case_fk" FOREIGN KEY ("tenant_id","case_id") REFERENCES "public"."cases"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_records" ADD CONSTRAINT "case_records_installation_fk" FOREIGN KEY ("tenant_id","installation_id") REFERENCES "public"."connector_installations"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_installations" ADD CONSTRAINT "connector_installations_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connector_versions_version_idx" ON "connector_versions" USING btree ("connector_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "case_records_ref_idx" ON "case_records" USING btree ("tenant_id","installation_id","type","external_ref");--> statement-breakpoint
CREATE INDEX "case_records_case_idx" ON "case_records" USING btree ("tenant_id","case_id");--> statement-breakpoint
CREATE INDEX "connector_installations_connector_idx" ON "connector_installations" USING btree ("tenant_id","connector_id");--> statement-breakpoint
CREATE POLICY "connector_installation_index_platform_all" ON "connector_installation_index" AS PERMISSIVE FOR ALL TO "lintelia_platform" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "connector_versions_platform_all" ON "connector_versions" AS PERMISSIVE FOR ALL TO "lintelia_platform" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "connectors_platform_all" ON "connectors" AS PERMISSIVE FOR ALL TO "lintelia_platform" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "case_records_tenant_isolation" ON "case_records" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "connector_installations_tenant_isolation" ON "connector_installations" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "connector_installations", "case_records" TO lintelia_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "connectors", "connector_versions", "connector_installation_index" TO lintelia_platform;
--> statement-breakpoint
ALTER TABLE "connector_installations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "case_records" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "connectors" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "connector_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "connector_installation_index" FORCE ROW LEVEL SECURITY;
