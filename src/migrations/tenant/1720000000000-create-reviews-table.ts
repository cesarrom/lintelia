import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateReviewsTable1720000000000 implements MigrationInterface {
    name = 'CreateReviewsTable1720000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE sys_reviews (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
                created_at TIMESTAMP DEFAULT now(),
                updated_at TIMESTAMP DEFAULT now()
            );
        `);

        await queryRunner.query(`
            ALTER TABLE sys_reviews
            ADD CONSTRAINT FK_node_execution_id
            FOREIGN KEY (node_execution_id) REFERENCES sys_workflow_node_executions(id)
            ON DELETE CASCADE;
        `);

        // Create indexes
        await queryRunner.query(`CREATE INDEX IDX_REVIEWS_STATUS ON sys_reviews (status);`);
        await queryRunner.query(`CREATE INDEX IDX_REVIEWS_ASSIGNED_TO ON sys_reviews (assigned_to);`);
        await queryRunner.query(`CREATE INDEX IDX_REVIEWS_NODE_EXECUTION_ID ON sys_reviews (node_execution_id);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE sys_reviews;`);
    }
} 