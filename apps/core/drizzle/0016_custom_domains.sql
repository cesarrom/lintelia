CREATE TABLE "custom_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"hostname" varchar(253) NOT NULL,
	"status" varchar(32) DEFAULT 'pending_verification' NOT NULL,
	"verification_token" varchar(64) NOT NULL,
	"failure_reason" text,
	"last_checked_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_by_email" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_domains" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "custom_domains" ADD CONSTRAINT "custom_domains_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_domains_hostname_idx" ON "custom_domains" USING btree ("hostname");--> statement-breakpoint
CREATE POLICY "custom_domains_platform_all" ON "custom_domains" AS PERMISSIVE FOR ALL TO "lintelia_platform" USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "custom_domains" TO lintelia_platform;
--> statement-breakpoint
ALTER TABLE "custom_domains" FORCE ROW LEVEL SECURITY;
