CREATE TABLE "data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"type" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"resolution" text,
	"result" jsonb,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_email" varchar(320),
	CONSTRAINT "data_requests_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "data_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_client_fk" FOREIGN KEY ("tenant_id","client_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_requests_status_idx" ON "data_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE POLICY "data_requests_tenant_isolation" ON "data_requests" AS PERMISSIVE FOR ALL TO "fintivio_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
-- Grants and forced RLS (see 0002_grants.sql for the model).
GRANT SELECT, INSERT, UPDATE, DELETE ON "data_requests" TO fintivio_app;
--> statement-breakpoint
ALTER TABLE "data_requests" FORCE ROW LEVEL SECURITY;
