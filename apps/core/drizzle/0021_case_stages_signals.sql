CREATE TABLE "case_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"status" varchar(16) NOT NULL,
	"promise" varchar(160),
	"payload" jsonb,
	"source" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "case_signals_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "case_signals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "stage" varchar(64);--> statement-breakpoint
ALTER TABLE "case_signals" ADD CONSTRAINT "case_signals_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_signals" ADD CONSTRAINT "case_signals_case_fk" FOREIGN KEY ("tenant_id","case_id") REFERENCES "public"."cases"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_signals_case_idx" ON "case_signals" USING btree ("tenant_id","case_id","name","status");--> statement-breakpoint
CREATE POLICY "case_signals_tenant_isolation" ON "case_signals" AS PERMISSIVE FOR ALL TO "fintivio_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "case_signals" TO fintivio_app;
--> statement-breakpoint
ALTER TABLE "case_signals" FORCE ROW LEVEL SECURITY;
