import { MigrationFn } from 'umzug';
import { AbstractQueryInterface } from '@sequelize/core';

export const name = 'FormInstancesAndAnswers1710000000001';

export const up: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    // Form Instances table
    await queryInterface.sequelize.query(`
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
    await queryInterface.sequelize.query(`
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

    await queryInterface.sequelize.query(`
        ALTER TABLE "sys_form_instances" ADD FOREIGN KEY ("form_id") REFERENCES "sys_forms" ("id") ON DELETE CASCADE
    `);
};

export const down: MigrationFn<AbstractQueryInterface> = async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "sys_form_answers" CASCADE`);
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "sys_form_instances" CASCADE`);
};