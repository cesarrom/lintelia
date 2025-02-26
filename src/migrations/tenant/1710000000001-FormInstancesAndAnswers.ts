import { MigrationInterface, QueryRunner } from "typeorm";

export class FormInstancesAndAnswers1710000000001 implements MigrationInterface {
    name = 'FormInstancesAndAnswers1710000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Form Instances table
        await queryRunner.query(`
            CREATE TABLE "sys_form_instances" (
                "id" uuid PRIMARY KEY NOT NULL,
                "form_id" uuid NOT NULL,
                "answers" jsonb NOT NULL,
                "variables" jsonb NOT NULL,
                "submitted_by" varchar NOT NULL,
                "status" varchar NOT NULL DEFAULT 'draft',
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Form Answers table
        await queryRunner.query(`
            CREATE TABLE "sys_form_answers" (
                "id" uuid PRIMARY KEY NOT NULL,
                "form_instance_id" uuid NOT NULL,
                "field_id" varchar NOT NULL,
                "value" jsonb NOT NULL,
                "created_by" varchar NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY ("form_instance_id") REFERENCES "sys_form_instances" ("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "sys_form_instances" ADD FOREIGN KEY ("form_id") REFERENCES "sys_forms" ("id") ON DELETE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "sys_form_answers" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sys_form_instances" CASCADE`);
    }
}