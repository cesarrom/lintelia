-- Roles used by row level security (see packages/lintelia/src/entities/rls.ts).
-- Roles are cluster-wide, so creation must be idempotent (several databases can share a cluster, e.g. dev + test).
-- They are created NOLOGIN; each environment grants LOGIN and a password out of band
-- (locally: apps/core/scripts/db.ts). Neither role is a superuser or has BYPASSRLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lintelia_app') THEN
    CREATE ROLE lintelia_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lintelia_platform') THEN
    CREATE ROLE lintelia_platform NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;
--> statement-breakpoint
-- Nobody but the owner may create objects in public; the application roles only get what is granted explicitly.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO lintelia_app, lintelia_platform;
