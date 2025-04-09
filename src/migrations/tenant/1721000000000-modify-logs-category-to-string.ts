import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateLogsTableCategory1721000000000 implements MigrationInterface {
    name = 'UpdateLogsTableCategory1721000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE sys_logs
            ALTER COLUMN category TYPE VARCHAR(255);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE sys_logs
            ALTER COLUMN category TYPE ENUM('system', 'workflow', 'user', 'form', 'security', 'integration', 'review')
            USING category::text::ENUM('system', 'workflow', 'user', 'form', 'security', 'integration', 'review');
        `);
    }
} 