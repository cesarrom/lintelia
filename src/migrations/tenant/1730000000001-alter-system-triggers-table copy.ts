import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterSystemTriggersTable1730000000001 implements MigrationInterface {
    name = 'AlterSystemTriggersTable1730000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."sys_system_triggers" ADD CONSTRAINT "sys_system_triggers_pkey" PRIMARY KEY ("id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."sys_system_triggers" DROP CONSTRAINT "sys_system_triggers_pkey"`);
    }
} 