CREATE TABLE "sso_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(32) DEFAULT 'workos' NOT NULL,
	"profile_id" varchar(128) NOT NULL,
	"connection_id" varchar(128),
	"idp_id" varchar(255),
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sso_identities_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sso_identities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenant_sso_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"organization_id" varchar(64),
	"enforce" boolean DEFAULT false NOT NULL,
	"jit_enabled" boolean DEFAULT false NOT NULL,
	"jit_default_roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"verified_domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_by_email" varchar(320),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_sso_settings_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "tenant_sso_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sso_identities" ADD CONSTRAINT "sso_identities_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_identities" ADD CONSTRAINT "sso_identities_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_sso_settings" ADD CONSTRAINT "tenant_sso_settings_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sso_identities_profile_idx" ON "sso_identities" USING btree ("tenant_id","provider","profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_sso_settings_tenant_idx" ON "tenant_sso_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE POLICY "sso_identities_tenant_isolation" ON "sso_identities" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_sso_settings_tenant_isolation" ON "tenant_sso_settings" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_sso_settings", "sso_identities" TO lintelia_app;
--> statement-breakpoint
ALTER TABLE "tenant_sso_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sso_identities" FORCE ROW LEVEL SECURITY;
