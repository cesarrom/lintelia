import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Form } from "./form.entity";

@Entity("sys_form_instances")
export class FormInstance {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => Form)
    @JoinColumn({ name: "form_id" })
    form!: Form;

    @Column({ name: "form_id" })
    formId!: string;

    @Column({
        type: "jsonb",
        transformer: {
            to: (value: Record<string, any>) => value,
            from: (value: Record<string, any>) => value
        }
    })
    answers!: Record<string, any>;

    @Column({ type: "jsonb" })
    variables!: Record<string, unknown>;

    @Column({ name: "submitted_by" })
    submittedBy!: string;

    @Column({ name: "status", default: "draft" })
    status!: "draft" | "submitted";

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date;
}

