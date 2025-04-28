import { MigrationFn } from 'umzug';
import { AbstractQueryInterface } from '@sequelize/core';

export const name = 'AlterSystemTriggersTable1730000000001';

export const up: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    // Warning: The table 'sys_system_triggers' might already have a primary key
    // defined in the migration '1720000000001-create-system-triggers-table.ts'.
    // Running this might cause an error if the constraint already exists.
    await queryInterface.sequelize.query(`
        ALTER TABLE "sys_system_triggers" ADD CONSTRAINT "sys_system_triggers_pkey" PRIMARY KEY ("id")
    `);
};

export const down: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(`
        ALTER TABLE "sys_system_triggers" DROP CONSTRAINT IF EXISTS "sys_system_triggers_pkey"
    `);
};