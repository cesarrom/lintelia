-- Grants for the tables added in 0003 (see 0002_grants.sql for the model).
GRANT SELECT, INSERT, UPDATE, DELETE ON "workflow_versions", "cases", "tasks" TO lintelia_app;
--> statement-breakpoint
-- The audit trail is append-only for the application: no UPDATE or DELETE, ever.
GRANT SELECT, INSERT ON "audit_events" TO lintelia_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "public_form_keys" TO lintelia_platform;
--> statement-breakpoint
ALTER TABLE "workflow_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cases" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public_form_keys" FORCE ROW LEVEL SECURITY;
