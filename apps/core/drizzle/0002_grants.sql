-- Table privileges for the application roles. drizzle-kit manages tables and policies but not GRANTs, so every new
-- table must be added here (in a new migration). `test/rls.test.ts` fails if a table is missing RLS, a policy or grants.
--
-- lintelia_platform: platform tables only (tenant directory, staff). No access to tenant data.
GRANT SELECT, INSERT, UPDATE, DELETE ON "tenants", "platform_users" TO lintelia_platform;
--> statement-breakpoint
-- lintelia_app: tenant data, always filtered by the tenant isolation policies. It can read and update its own tenant
-- row (branding) but never create or delete tenants, and it has no access to platform_users.
GRANT SELECT, UPDATE ON "tenants" TO lintelia_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "users", "roles", "user_roles",
  "sys_email_templates", "sys_form_answers", "sys_form_instances", "sys_forms", "sys_invitations", "sys_key_values",
  "sys_logs", "sys_reviews", "sys_system_triggers", "sys_system_variables", "sys_workflow_executions",
  "sys_workflow_triggers", "sys_workflows", "sys_document_templates", "sys_documents"
TO lintelia_app;
--> statement-breakpoint
-- Apply the policies to the table owner as well (superusers still bypass RLS; the app never connects as one).
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END
$$;
