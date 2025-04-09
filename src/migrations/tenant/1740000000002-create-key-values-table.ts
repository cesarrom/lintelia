import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateKeyValuesTable1740000000002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "sys_key_values",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                    },
                    {
                        name: "key",
                        type: "varchar",
                        length: "255",
                        isNullable: false,
                    },
                    {
                        name: "value",
                        type: "text",
                        isNullable: false,
                    },
                    {
                        name: "created_by",
                        type: "varchar",
                        isNullable: false,
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "now()",
                    },
                    {
                        name: "updated_at",
                        type: "timestamp",
                        default: "now()",
                    },
                    {
                        name: "description",
                        type: "text",
                        isNullable: true,
                    },
                ],
            }),
            true
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("sys_key_values");
    }
}
