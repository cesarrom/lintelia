import { MigrationFn } from 'umzug';
import { AbstractQueryInterface, QueryTypes } from '@sequelize/core';

export const name = 'CreateSystemTriggersTable1720000000001';

export const up: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    // Check if table exists and drop if it does (replicating original logic)
    const tables = await queryInterface.sequelize.query<{ table_name: string }>( 
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sys_system_triggers'`, 
        { type: QueryTypes.SELECT }
    );

    if (tables.length > 0) {
        await queryInterface.sequelize.query(`DROP TABLE "sys_system_triggers" CASCADE`);
    }

    // Create the table
    await queryInterface.sequelize.query(`
        CREATE TABLE "sys_system_triggers" (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            pattern JSONB NOT NULL,
            action JSONB NOT NULL,
            created_by VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create indexes for efficient pattern matching and JSONB operations
    await queryInterface.sequelize.query(`CREATE INDEX "IDX_SYSTEM_TRIGGERS_IS_ACTIVE" ON "sys_system_triggers" (is_active)`);
    await queryInterface.sequelize.query(`CREATE INDEX "IDX_SYSTEM_TRIGGERS_CREATED_BY" ON "sys_system_triggers" (created_by)`);
    
    // GIN index for JSONB pattern field
    await queryInterface.sequelize.query(`CREATE INDEX "IDX_SYSTEM_TRIGGERS_PATTERN" ON "sys_system_triggers" USING GIN (pattern jsonb_path_ops)`);
    
    // GIN index for JSONB action field
    await queryInterface.sequelize.query(`CREATE INDEX "IDX_SYSTEM_TRIGGERS_ACTION" ON "sys_system_triggers" USING GIN (action jsonb_path_ops)`);
};

export const down: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "sys_system_triggers"`);
};