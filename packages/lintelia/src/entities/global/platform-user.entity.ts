import { sql } from 'drizzle-orm';
import { pgTable, varchar, timestamp, uuid, pgPolicy, pgEnum, uniqueIndex, text } from 'drizzle-orm/pg-core';
import { platformRole } from '../rls';

export const platformUserStatusEnum = pgEnum('platform_user_status', ['active', 'disabled', 'invited']);

/**
 * Platform staff ("us"): the people who onboard and operate tenants. Not visible to tenant-scoped connections
 * (no grants and no policy for `lintelia_app`).
 */
export const platformUsers = pgTable('platform_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 320 }).notNull(),
  name: varchar('name', { length: 255 }).default('').notNull(),
  passwordHash: varchar('password_hash', { length: 512 }),
  status: platformUserStatusEnum('status').default('active').notNull(),
  /** Platform role keys (PLATFORM_ROLES in the authorization catalogue). */
  roles: text('roles').array().default(sql`'{}'::text[]`).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('platform_users_email_idx').on(sql`lower(${table.email})`),
  pgPolicy('platform_users_platform_all', { as: 'permissive', for: 'all', to: platformRole, using: sql`true`, withCheck: sql`true` }),
]);
