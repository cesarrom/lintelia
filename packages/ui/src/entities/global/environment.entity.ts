import { pgTable, varchar } from 'drizzle-orm/pg-core';

export const environments = pgTable('environments', {
  name: varchar('name', { length: 255 }).primaryKey().notNull(),
  distributionArn: varchar('distribution_arn').notNull(), // Assuming varchar without specific length is ok
});