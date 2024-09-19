CREATE TABLE IF NOT EXISTS "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255) NOT NULL,
	"logo_url" varchar(255) NOT NULL,
	"pallette" jsonb NOT NULL,
	"database_id" text NOT NULL,
	"database_name" text NOT NULL,
	"database_url" text NOT NULL,
	"database_auth_token" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "tenants_domain_unique" UNIQUE("domain")
);
