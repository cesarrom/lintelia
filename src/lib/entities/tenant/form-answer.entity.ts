import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { FormInstance } from "./form-instance.entity";

@Entity("sys_form_answers")
export class FormAnswer {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => FormInstance)
    @JoinColumn({ name: "form_instance_id" })
    formInstance!: FormInstance;

    @Column({ name: "form_instance_id" })
    formInstanceId!: string;

    @Column({ name: "field_id" })
    fieldId!: string;

    @Column({
        type: "jsonb",
        transformer: {
            to: (value: any) => value,
            from: (value: any) => value
        }
    })
    value!: any;

    @Column({ name: "created_by" })
    createdBy!: string;

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt!: Date;
}

