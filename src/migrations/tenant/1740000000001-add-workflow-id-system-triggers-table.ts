import { MigrationFn } from 'umzug';
import { AbstractQueryInterface } from '@sequelize/core';

export const name = 'AddWorkflowIdToSystemTriggersTable1740000000001';

export const up: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(`ALTER TABLE "sys_system_triggers" ADD COLUMN "workflow_id" uuid NOT NULL`);
    await queryInterface.sequelize.query(`ALTER TABLE "sys_system_triggers" ADD CONSTRAINT "FK_workflow_id" FOREIGN KEY ("workflow_id") REFERENCES "sys_workflows"("id") ON DELETE CASCADE`);
};

export const down: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(`ALTER TABLE "sys_system_triggers" DROP CONSTRAINT IF EXISTS "FK_workflow_id"`);
    await queryInterface.sequelize.query(`ALTER TABLE "sys_system_triggers" DROP COLUMN IF EXISTS "workflow_id"`);
};