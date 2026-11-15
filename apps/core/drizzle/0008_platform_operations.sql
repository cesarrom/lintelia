ALTER TYPE "public"."platform_user_status" ADD VALUE 'invited';--> statement-breakpoint
CREATE TABLE "platform_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" varchar(16) NOT NULL,
	"actor_id" varchar(64),
	"actor_email" varchar(320),
	"action" varchar(64) NOT NULL,
	"target_type" varchar(32),
	"target_id" varchar(64),
	"tenant_id" uuid,
	"tenant_key" varchar(255),
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"previous_hash" varchar(64),
	"hash" varchar(64) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "support_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"staff_email" varchar(320) NOT NULL,
	"reason" text NOT NULL,
	"scope" varchar(16) DEFAULT 'read' NOT NULL,
	"duration_minutes" integer NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_email" varchar(320),
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "support_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "support_grants" ADD CONSTRAINT "support_grants_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_grants" ADD CONSTRAINT "support_grants_staff_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."platform_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_audit_events_seq_idx" ON "platform_audit_events" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "platform_audit_events_tenant_idx" ON "platform_audit_events" USING btree ("tenant_key");--> statement-breakpoint
CREATE INDEX "support_grants_tenant_idx" ON "support_grants" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE POLICY "platform_audit_events_platform_all" ON "platform_audit_events" AS PERMISSIVE FOR ALL TO "fintivio_platform" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "support_grants_platform_all" ON "support_grants" AS PERMISSIVE FOR ALL TO "fintivio_platform" USING (true) WITH CHECK (true);--> statement-breakpoint
-- Platform tables: only the platform role. The platform audit trail is append-only (no UPDATE/DELETE).
GRANT SELECT, INSERT ON "platform_audit_events" TO fintivio_platform;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "support_grants" TO fintivio_platform;
--> statement-breakpoint
ALTER TABLE "platform_audit_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "support_grants" FORCE ROW LEVEL SECURITY;
