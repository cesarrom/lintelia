import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateLogsTable1709170100000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "sys_logs",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "uuid"
                    },
                    {
                        name: "message",
                        type: "varchar",
                        length: "255"
                    },
                    {
                        name: "details",
                        type: "text",
                        isNullable: true
                    },
                    {
                        name: "level",
                        type: "enum",
                        enum: ["info", "warning", "error", "debug"],
                        default: "'info'"
                    },
                    {
                        name: "category",
                        type: "enum",
                        enum: ["system", "workflow", "user", "form", "security", "integration"],
                        default: "'system'"
                    },
                    {
                        name: "source",
                        type: "varchar",
                        length: "255",
                        isNullable: true
                    },
                    {
                        name: "user_id",
                        type: "varchar",
                        length: "255",
                        isNullable: true
                    },
                    {
                        name: "metadata",
                        type: "jsonb",
                        isNullable: true
                    },
                    {
                        name: "acknowledged",
                        type: "boolean",
                        default: false
                    },
                    {
                        name: "acknowledged_by",
                        type: "varchar",
                        length: "255",
                        isNullable: true
                    },
                    {
                        name: "acknowledged_at",
                        type: "timestamp",
                        isNullable: true
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

        // Create indexes for better performance
        await queryRunner.createIndex("sys_logs", {
            name: "IDX_logs_created_at",
            columnNames: ["created_at"]
        });

        await queryRunner.createIndex("sys_logs", {
            name: "IDX_logs_level",
            columnNames: ["level"]
        });

        await queryRunner.createIndex("sys_logs", {
            name: "IDX_logs_category",
            columnNames: ["category"]
        });
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("sys_logs");
    }
} 