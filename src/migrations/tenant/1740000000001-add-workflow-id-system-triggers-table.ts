import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkflowIdToSystemTriggersTable1740000000001 implements MigrationInterface {
    name = 'AddWorkflowIdToSystemTriggersTable1740000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."sys_system_triggers" ADD COLUMN "workflow_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."sys_system_triggers" ADD CONSTRAINT "FK_workflow_id" FOREIGN KEY ("workflow_id") REFERENCES "sys_workflows"("id") ON DELETE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."sys_system_triggers" DROP CONSTRAINT "FK_workflow_id"`);
        await queryRunner.query(`ALTER TABLE "public"."sys_system_triggers" DROP COLUMN "workflow_id"`);
    }
} 