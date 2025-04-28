import { MigrationFn } from 'umzug';
import { AbstractQueryInterface } from '@sequelize/core';

export const name = 'CreateLogsTable1719170100000';

// Define ENUM type names
const enumLevelName = 'log_level';
const enumCategoryName = 'log_category';

export const up: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    // Create ENUM types first
    await queryInterface.sequelize.query(`
        CREATE TYPE ${enumLevelName} AS ENUM ('info', 'warning', 'error', 'debug');
    `);
    await queryInterface.sequelize.query(`
        CREATE TYPE ${enumCategoryName} AS ENUM ('system', 'workflow', 'user', 'form', 'security', 'integration');
    `);

    // Create table using the ENUM types
    await queryInterface.sequelize.query(`
        CREATE TABLE "sys_logs" (
            "id" uuid PRIMARY KEY NOT NULL, 
            "message" varchar(255) NOT NULL,
            "details" text,
            "level" ${enumLevelName} NOT NULL DEFAULT 'info',
            "category" ${enumCategoryName} NOT NULL DEFAULT 'system',
            "source" varchar(255),
            "user_id" varchar(255),
            "metadata" jsonb,
            "acknowledged" boolean NOT NULL DEFAULT false,
            "acknowledged_by" varchar(255),
            "acknowledged_at" TIMESTAMP,
            "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create indexes
    await queryInterface.sequelize.query(`
        CREATE INDEX "IDX_logs_created_at" ON "sys_logs" ("created_at")
    `);
    await queryInterface.sequelize.query(`
        CREATE INDEX "IDX_logs_level" ON "sys_logs" ("level")
    `);
    await queryInterface.sequelize.query(`
        CREATE INDEX "IDX_logs_category" ON "sys_logs" ("category")
    `);
};

export const down: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "sys_logs"`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS ${enumLevelName}`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS ${enumCategoryName}`);
};