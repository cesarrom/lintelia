CREATE TABLE IF NOT EXISTS "default_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"purpose" varchar(255) NOT NULL,
	"form_data" jsonb NOT NULL,
	"version" bigint NOT NULL
);
