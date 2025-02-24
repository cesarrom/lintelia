import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { type FormConfig } from "@/types/form";

@Entity("sys_forms")
export class Form {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ length: 255 })
    name!: string;

    @Column({ type: "text", nullable: true })
    description?: string;

    @Column({
        type: "text",
        transformer: {
            to: (value: FormConfig) => JSON.stringify(value),
            from: (value: string) => JSON.parse(value),
        }
    })
    config!: FormConfig;

    @Column({ name: "created_by" })
    createdBy!: string;

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date;
} 