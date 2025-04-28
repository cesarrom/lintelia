import { MigrationFn } from 'umzug';
import { AbstractQueryInterface } from '@sequelize/core';

export const name = 'UpdateLogsTableCategory1721000000000';

// Assuming 'log_category' ENUM type was created in a previous migration
const enumCategoryName = 'log_category'; 

export const up: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(`
        ALTER TABLE "sys_logs"
        ALTER COLUMN category TYPE VARCHAR(255);
    `);
};

export const down: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    // Note: The original down migration added 'review' to the enum. 
    // If the 'log_category' enum should revert *exactly* to its state before this migration,
    // the ENUM definition might need adjustment.
    // Assuming the intention is to revert to *some* ENUM type:
    await queryInterface.sequelize.query(`
        ALTER TABLE "sys_logs"
        ALTER COLUMN category TYPE ${enumCategoryName} 
        USING category::text::${enumCategoryName};
    `);

    // If the ENUM type itself needs modification (e.g., dropping 'review' if it wasn't there before)
    // that would require additional ALTER TYPE commands, which are more complex and depend
    // on the exact state desired.
};