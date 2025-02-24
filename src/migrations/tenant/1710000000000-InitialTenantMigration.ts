import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialTenantMigration1710000000000 implements MigrationInterface {
    name = 'InitialTenantMigration1710000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Invitations table
        await queryRunner.query(`
            CREATE TABLE "sys_invitations" (
                "id" varchar PRIMARY KEY NOT NULL,
                "email" varchar NOT NULL UNIQUE,
                "role_id" varchar NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Forms table
        await queryRunner.query(`
            CREATE TABLE "sys_forms" (
                "id" varchar PRIMARY KEY NOT NULL,
                "name" varchar(255) NOT NULL,
                "description" text,
                "config" text NOT NULL,
                "created_by" varchar NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Email Templates table
        await queryRunner.query(`
            CREATE TABLE "sys_email_templates" (
                "id" varchar PRIMARY KEY NOT NULL,
                "name" varchar(255) NOT NULL,
                "description" text,
                "subject" varchar NOT NULL,
                "body" text NOT NULL,
                "variables" text NOT NULL,
                "created_by" varchar NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Workflows table
        await queryRunner.query(`
            CREATE TABLE "sys_workflows" (
                "id" varchar PRIMARY KEY NOT NULL,
                "name" varchar(255) NOT NULL,
                "description" text,
                "yaml" text NOT NULL,
                "allowed_roles" text NOT NULL,
                "allowed_users" text NOT NULL,
                "created_by" varchar NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Workflow Triggers table
        await queryRunner.query(`
            CREATE TABLE "sys_workflow_triggers" (
                "id" varchar PRIMARY KEY NOT NULL,
                "workflow_id" varchar NOT NULL,
                "name" varchar(255) NOT NULL,
                "description" text,
                "type" varchar NOT NULL,
                "event_name" varchar NOT NULL,
                "config" text NOT NULL,
                "status" varchar NOT NULL DEFAULT 'active',
                "created_by" varchar NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY ("workflow_id") REFERENCES "sys_workflows" ("id") ON DELETE CASCADE
            )
        `);

        // Workflow Executions table
        await queryRunner.query(`
            CREATE TABLE "sys_workflow_executions" (
                "id" varchar PRIMARY KEY NOT NULL,
                "workflow_id" varchar NOT NULL,
                "status" varchar NOT NULL DEFAULT 'pending',
                "started_at" TIMESTAMP,
                "completed_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY ("workflow_id") REFERENCES "sys_workflows" ("id") ON DELETE CASCADE
            )
        `);

        // Workflow Node Executions table
        await queryRunner.query(`
            CREATE TABLE "sys_workflow_node_executions" (
                "id" varchar PRIMARY KEY NOT NULL,
                "execution_id" varchar NOT NULL,
                "node_id" varchar NOT NULL,
                "status" varchar NOT NULL DEFAULT 'pending',
                "started_at" TIMESTAMP,
                "completed_at" TIMESTAMP,
                "executed_by" varchar,
                "executed_by_role" varchar,
                "config" text NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY ("execution_id") REFERENCES "sys_workflow_executions" ("id") ON DELETE CASCADE
            )
        `);

        // Workflow Node Execution Edges table
        await queryRunner.query(`
            CREATE TABLE "sys_workflow_node_executions_edges" (
                "execution_id" varchar NOT NULL,
                "node_execution_id" varchar NOT NULL,
                "event_name" varchar NOT NULL,
                "result" text,
                "error" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY ("node_execution_id", "event_name"),
                FOREIGN KEY ("node_execution_id") REFERENCES "sys_workflow_node_executions" ("id") ON DELETE CASCADE
            )
        `);

        // Workflow Execution Listeners table
        await queryRunner.query(`
            CREATE TABLE "sys_workflow_execution_listeners" (
                "id" varchar PRIMARY KEY NOT NULL,
                "execution_id" varchar NOT NULL,
                "listener_id" varchar NOT NULL,
                "event" varchar NOT NULL,
                "source_id" varchar,
                "source_type" varchar NOT NULL,
                "status" varchar NOT NULL DEFAULT 'waiting',
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY ("execution_id") REFERENCES "sys_workflow_executions" ("id") ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "sys_workflow_execution_listeners" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sys_workflow_node_executions_edges" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sys_workflow_node_executions" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sys_workflow_executions" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sys_workflow_triggers" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sys_workflows" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sys_email_templates" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sys_forms" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sys_invitations" CASCADE`);
    }
}