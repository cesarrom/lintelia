ALTER TABLE "tenants" ADD COLUMN "allowed_domains" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "address_line_1" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "address_line_2" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "city" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "state" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "zip_code" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "start_working_hour" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "end_working_hour" varchar(255) NOT NULL;