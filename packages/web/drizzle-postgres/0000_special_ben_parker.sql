CREATE TABLE IF NOT EXISTS "default_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"purpose" varchar(255) NOT NULL,
	"form_key" varchar(255),
	"dmn_key" varchar(255),
	"version" bigint DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "environments" (
	"name" varchar(255) PRIMARY KEY NOT NULL,
	"distribution_arn" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255) NOT NULL,
	"logo_url" varchar(255) NOT NULL,
	"pallette" jsonb NOT NULL,
	"allowed_domains" jsonb NOT NULL,
	"database_id" text NOT NULL,
	"database_name" text NOT NULL,
	"database_url" text NOT NULL,
	"address_line_1" varchar(255) NOT NULL,
	"address_line_2" varchar(255) NOT NULL,
	"city" varchar(255) NOT NULL,
	"country" varchar(255) NOT NULL,
	"state" varchar(255) NOT NULL,
	"zip_code" varchar(255) NOT NULL,
	"start_working_hour" varchar(255) NOT NULL,
	"end_working_hour" varchar(255) NOT NULL,
	"database_auth_token" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "tenants_domain_unique" UNIQUE("domain")
);
