import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSystemTriggersTable1720000000001 implements MigrationInterface {
    name = 'CreateSystemTriggersTable1720000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('sys_system_triggers');
        if (tableExists) {
            await queryRunner.query(`DROP TABLE sys_system_triggers CASCADE`);
        }
        await queryRunner.query(`
            CREATE TABLE sys_system_triggers (
                id UUID DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_active BOOLEAN NOT NULL DEFAULT true,
                pattern JSONB NOT NULL,
                action JSONB NOT NULL,
                created_by VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

        // Create indexes for efficient pattern matching and JSONB operations
        await queryRunner.query(`CREATE INDEX IDX_SYSTEM_TRIGGERS_IS_ACTIVE ON sys_system_triggers (is_active)`);
        await queryRunner.query(`CREATE INDEX IDX_SYSTEM_TRIGGERS_CREATED_BY ON sys_system_triggers (created_by)`);
        
        // GIN index for JSONB pattern field
        await queryRunner.query(`CREATE INDEX IDX_SYSTEM_TRIGGERS_PATTERN ON sys_system_triggers USING GIN (pattern jsonb_path_ops)`);
        
        // GIN index for JSONB action field
        await queryRunner.query(`CREATE INDEX IDX_SYSTEM_TRIGGERS_ACTION ON sys_system_triggers USING GIN (action jsonb_path_ops)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE sys_system_triggers`);
    }
} 