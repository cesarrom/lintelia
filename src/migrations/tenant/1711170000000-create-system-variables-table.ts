import { MigrationFn } from 'umzug';
import { AbstractQueryInterface } from '@sequelize/core';

export const name = 'CreateSystemVariablesTable1711170000000';

// Define ENUM type name
const enumTypeName = 'system_variable_type';

export const up: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    // Create ENUM type first
    await queryInterface.sequelize.query(`
        CREATE TYPE ${enumTypeName} AS ENUM ('string', 'number', 'boolean', 'json', 'array');
    `);

    // Create table using the ENUM type
    await queryInterface.sequelize.query(`
        CREATE TABLE "sys_system_variables" (
            "id" uuid PRIMARY KEY NOT NULL, 
            "name" varchar(255) UNIQUE NOT NULL,
            "description" varchar(255),
            "type" ${enumTypeName} NOT NULL,
            "value" jsonb NOT NULL,
            "is_protected" boolean NOT NULL DEFAULT false,
            "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

export const down: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "sys_system_variables"`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS ${enumTypeName}`);
};