import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateSystemVariablesTable1709170000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "sys_system_variables",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "uuid"
                    },
                    {
                        name: "name",
                        type: "varchar",
                        length: "255",
                        isUnique: true
                    },
                    {
                        name: "description",
                        type: "varchar",
                        length: "255"
                    },
                    {
                        name: "type",
                        type: "enum",
                        enum: ["string", "number", "boolean", "json", "array"]
                    },
                    {
                        name: "value",
                        type: "jsonb"
                    },
                    {
                        name: "is_protected",
                        type: "boolean",
                        default: false
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "now()"
                    },
                    {
                        name: "updated_at",
                        type: "timestamp",
                        default: "now()"
                    }
                ]
            }),
            true
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("sys_system_variables");
    }
} 