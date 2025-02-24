import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1710000000000 implements MigrationInterface {
    name = 'InitialMigration1710000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "tenants" (
                "id" SERIAL NOT NULL,
                "name" character varying(255) NOT NULL,
                "domain" character varying(255) NOT NULL,
                "logo_url" character varying(255) NOT NULL,
                "pallette" jsonb NOT NULL,
                "allowed_domains" text[] NOT NULL DEFAULT ARRAY[]::text[],
                "database_password" text NOT NULL,
                "database_id" text NOT NULL,
                "database_url" text NOT NULL,
                "address_line_1" character varying(255) NOT NULL,
                "address_line_2" character varying(255) NOT NULL,
                "city" character varying(255) NOT NULL,
                "country" character varying(255) NOT NULL,
                "state" character varying(255) NOT NULL,
                "zip_code" character varying(255) NOT NULL,
                "start_working_hour" character varying(255) NOT NULL,
                "end_working_hour" character varying(255) NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_tenants_domain" UNIQUE ("domain"),
                CONSTRAINT "PK_tenants" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "environments" (
                "name" character varying(255) NOT NULL,
                "distribution_arn" text NOT NULL,
                CONSTRAINT "PK_environments" PRIMARY KEY ("name")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "environments"`);
        await queryRunner.query(`DROP TABLE "tenants"`);
    }
} 