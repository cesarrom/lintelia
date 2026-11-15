import { pgTable, serial, bigint, varchar, text, unique, jsonb, timestamp } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const typeormMigrations = pgTable("typeorm_migrations", {
	id: serial().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	timestamp: bigint({ mode: "number" }).notNull(),
	name: varchar().notNull(),
});

export const environments = pgTable("environments", {
	name: varchar({ length: 255 }).primaryKey().notNull(),
	distributionArn: text("distribution_arn").notNull(),
});

export const tenants = pgTable("tenants", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	domain: varchar({ length: 255 }).notNull(),
	logoUrl: varchar("logo_url", { length: 255 }).notNull(),
	pallette: jsonb().notNull(),
	allowedDomains: text("allowed_domains").array().default(["RAY"]).notNull(),
	databasePassword: text("database_password").notNull(),
	databaseId: text("database_id").notNull(),
	databaseUrl: text("database_url").notNull(),
	addressLine1: varchar("address_line_1", { length: 255 }).notNull(),
	addressLine2: varchar("address_line_2", { length: 255 }).notNull(),
	city: varchar({ length: 255 }).notNull(),
	country: varchar({ length: 255 }).notNull(),
	state: varchar({ length: 255 }).notNull(),
	zipCode: varchar("zip_code", { length: 255 }).notNull(),
	startWorkingHour: varchar("start_working_hour", { length: 255 }).notNull(),
	endWorkingHour: varchar("end_working_hour", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("UQ_tenants_domain").on(table.domain),
]);
