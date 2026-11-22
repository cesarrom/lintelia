CREATE TABLE "case_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'invited' NOT NULL,
	"name" varchar(255),
	"email" varchar(320) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"share" integer,
	"child_case_id" uuid,
	"invited_by" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_parties_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "case_parties" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "parent_case_id" uuid;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "parent_step_id" varchar(128);--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "parent_promise" varchar(160);--> statement-breakpoint
ALTER TABLE "case_parties" ADD CONSTRAINT "case_parties_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_parties" ADD CONSTRAINT "case_parties_case_fk" FOREIGN KEY ("tenant_id","case_id") REFERENCES "public"."cases"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_parties" ADD CONSTRAINT "case_parties_person_fk" FOREIGN KEY ("tenant_id","person_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "case_parties_person_idx" ON "case_parties" USING btree ("tenant_id","case_id","person_id","role");--> statement-breakpoint
CREATE INDEX "case_parties_person_lookup_idx" ON "case_parties" USING btree ("tenant_id","person_id");--> statement-breakpoint
CREATE INDEX "cases_parent_idx" ON "cases" USING btree ("tenant_id","parent_case_id");--> statement-breakpoint
CREATE POLICY "case_parties_tenant_isolation" ON "case_parties" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "case_parties" TO lintelia_app;
--> statement-breakpoint
ALTER TABLE "case_parties" FORCE ROW LEVEL SECURITY;
