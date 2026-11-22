CREATE TABLE "platform_mfa_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"type" varchar(16) NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"recovery_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_used_step" bigint,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_mfa_factors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mfa_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(16) NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"recovery_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_used_step" bigint,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mfa_factors_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "mfa_factors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenant_security_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT nullif(current_setting('app.tenant_id', true), '')::uuid NOT NULL,
	"require_mfa" boolean DEFAULT true NOT NULL,
	"updated_by_email" varchar(320),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_security_policies_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "tenant_security_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_mfa_factors" ADD CONSTRAINT "platform_mfa_factors_staff_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."platform_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_security_policies" ADD CONSTRAINT "tenant_security_policies_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_mfa_factors_staff_type_idx" ON "platform_mfa_factors" USING btree ("staff_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "mfa_factors_user_type_idx" ON "mfa_factors" USING btree ("tenant_id","user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_security_policies_tenant_idx" ON "tenant_security_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE POLICY "platform_mfa_factors_platform_all" ON "platform_mfa_factors" AS PERMISSIVE FOR ALL TO "lintelia_platform" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "mfa_factors_tenant_isolation" ON "mfa_factors" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_security_policies_tenant_isolation" ON "tenant_security_policies" AS PERMISSIVE FOR ALL TO "lintelia_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "mfa_factors", "tenant_security_policies" TO lintelia_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "platform_mfa_factors" TO lintelia_platform;
--> statement-breakpoint
ALTER TABLE "mfa_factors" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_security_policies" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "platform_mfa_factors" FORCE ROW LEVEL SECURITY;
