CREATE TABLE "platform_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_email" varchar(320),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "platform_settings_platform_all" ON "platform_settings" AS PERMISSIVE FOR ALL TO "fintivio_platform" USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "platform_settings" TO fintivio_platform;
--> statement-breakpoint
ALTER TABLE "platform_settings" FORCE ROW LEVEL SECURITY;
