import { MigrationFn } from 'umzug';
import { AbstractQueryInterface } from '@sequelize/core';

export const name = 'CreateKeyValuesTable1740000000002';

export const up: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(`
        CREATE TABLE "sys_key_values" (
            "id" uuid PRIMARY KEY NOT NULL, 
            "key" varchar(255) NOT NULL,
            "value" text NOT NULL,
            "created_by" varchar NOT NULL,
            "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "description" text
        )
    `);
};

export const down: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "sys_key_values"`);
};
