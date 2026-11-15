CREATE TABLE "case_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"task_id" uuid,
	"item_key" varchar(128),
	"upload_id" uuid,
	"name" varchar(255) NOT NULL,
	"size" bigint NOT NULL,
	"content_type" varchar(128) NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"storage_key" text NOT NULL,
	"source" varchar(16) NOT NULL,
	"uploaded_by_id" uuid,
	"uploaded_by_email" varchar(320),
	"report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_files_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "case_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"purpose" varchar(32) NOT NULL,
	"owner_type" varchar(16) NOT NULL,
	"owner_id" uuid NOT NULL,
	"case_id" uuid,
	"task_id" uuid,
	"item_key" varchar(128),
	"declared_name" varchar(255) NOT NULL,
	"declared_size" bigint NOT NULL,
	"declared_type" varchar(128) NOT NULL,
	"declared_sha256" varchar(64),
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"file_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploads_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "uploads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_case_fk" FOREIGN KEY ("tenant_id","case_id") REFERENCES "public"."cases"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_case_fk" FOREIGN KEY ("tenant_id","case_id") REFERENCES "public"."cases"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_files_case_idx" ON "case_files" USING btree ("tenant_id","case_id");--> statement-breakpoint
CREATE INDEX "uploads_owner_idx" ON "uploads" USING btree ("tenant_id","owner_id","status");--> statement-breakpoint
CREATE POLICY "case_files_tenant_isolation" ON "case_files" AS PERMISSIVE FOR ALL TO "fintivio_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "uploads_tenant_isolation" ON "uploads" AS PERMISSIVE FOR ALL TO "fintivio_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "uploads", "case_files" TO fintivio_app;
--> statement-breakpoint
ALTER TABLE "uploads" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "case_files" FORCE ROW LEVEL SECURITY;
