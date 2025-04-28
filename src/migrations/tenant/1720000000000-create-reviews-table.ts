import { MigrationFn } from 'umzug';
import { AbstractQueryInterface } from '@sequelize/core';

export const name = 'CreateReviewsTable1720000000000';

export const up: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(`
        CREATE TABLE "sys_reviews" (
            id UUID PRIMARY KEY NOT NULL, 
            node_execution_id UUID NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(255) NOT NULL DEFAULT 'pending',
            assigned_to VARCHAR(255),
            assigned_at TIMESTAMP,
            completed_by VARCHAR(255),
            completed_at TIMESTAMP,
            comments TEXT,
            rejection_reason TEXT,
            additional_data_request TEXT,
            review_items JSONB NOT NULL DEFAULT '[]',
            evidence JSONB,
            due_date TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await queryInterface.sequelize.query(`
        ALTER TABLE "sys_reviews"
        ADD CONSTRAINT FK_node_execution_id
        FOREIGN KEY (node_execution_id) REFERENCES sys_workflow_node_executions(id)
        ON DELETE CASCADE;
    `);

    // Create indexes
    await queryInterface.sequelize.query(`CREATE INDEX "IDX_REVIEWS_STATUS" ON "sys_reviews" (status);`);
    await queryInterface.sequelize.query(`CREATE INDEX "IDX_REVIEWS_ASSIGNED_TO" ON "sys_reviews" (assigned_to);`);
    await queryInterface.sequelize.query(`CREATE INDEX "IDX_REVIEWS_NODE_EXECUTION_ID" ON "sys_reviews" (node_execution_id);`);
};

export const down: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "sys_reviews";`);
};