CREATE TABLE "sso_organization_index" (
	"organization_id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sso_organization_index" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_sso_settings" ADD COLUMN "events_cursor" varchar(128);--> statement-breakpoint
ALTER TABLE "sso_organization_index" ADD CONSTRAINT "sso_organization_index_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "sso_organization_index_platform_all" ON "sso_organization_index" AS PERMISSIVE FOR ALL TO "fintivio_platform" USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "sso_organization_index" TO fintivio_platform;
--> statement-breakpoint
ALTER TABLE "sso_organization_index" FORCE ROW LEVEL SECURITY;
