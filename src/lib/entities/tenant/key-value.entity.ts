import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("sys_key_values")
export class KeyValue {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ length: 255 })
    key!: string;

    @Column({ type: "text" })
    value!: string;

    @Column({ name: "created_by" })
    createdBy!: string;

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date;

    @Column({ type: "text", nullable: true })
    description?: string;
}