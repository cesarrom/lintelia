CREATE TABLE "client_app_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"published_by" varchar(320),
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_app_versions_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "client_app_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "client_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"key" varchar(64) DEFAULT 'default' NOT NULL,
	"name" varchar(255) NOT NULL,
	"draft" jsonb NOT NULL,
	"active_version" integer,
	"updated_by" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_apps_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "client_apps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "client_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"tone" varchar(16) DEFAULT 'info' NOT NULL,
	"link" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_notifications_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "client_notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "client_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"external_source" varchar(255),
	"external_id" varchar(255),
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"segments" text[] DEFAULT '{}'::text[] NOT NULL,
	"consents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_profiles_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "client_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "client_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"collection" varchar(64) NOT NULL,
	"key" varchar(128) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" varchar(128) DEFAULT 'api' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_records_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "client_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "screen" jsonb;--> statement-breakpoint
ALTER TABLE "client_app_versions" ADD CONSTRAINT "client_app_versions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_app_versions" ADD CONSTRAINT "client_app_versions_app_fk" FOREIGN KEY ("tenant_id","app_id") REFERENCES "public"."client_apps"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_apps" ADD CONSTRAINT "client_apps_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notifications" ADD CONSTRAINT "client_notifications_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notifications" ADD CONSTRAINT "client_notifications_client_fk" FOREIGN KEY ("tenant_id","client_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_records" ADD CONSTRAINT "client_records_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_records" ADD CONSTRAINT "client_records_client_fk" FOREIGN KEY ("tenant_id","client_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_app_versions_idx" ON "client_app_versions" USING btree ("tenant_id","app_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "client_apps_key_idx" ON "client_apps" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "client_notifications_client_idx" ON "client_notifications" USING btree ("tenant_id","client_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "client_profiles_user_idx" ON "client_profiles" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_profiles_external_idx" ON "client_profiles" USING btree ("tenant_id","external_source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_records_key_idx" ON "client_records" USING btree ("tenant_id","client_id","collection","key");--> statement-breakpoint
CREATE INDEX "client_records_collection_idx" ON "client_records" USING btree ("tenant_id","client_id","collection");--> statement-breakpoint
CREATE POLICY "client_app_versions_tenant_isolation" ON "client_app_versions" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "client_apps_tenant_isolation" ON "client_apps" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "client_notifications_tenant_isolation" ON "client_notifications" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "client_profiles_tenant_isolation" ON "client_profiles" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "client_records_tenant_isolation" ON "client_records" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "client_apps", "client_app_versions", "client_profiles", "client_records", "client_notifications" TO lintelia_app;
--> statement-breakpoint
ALTER TABLE "client_apps" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "client_app_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "client_profiles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "client_records" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "client_notifications" FORCE ROW LEVEL SECURITY;
