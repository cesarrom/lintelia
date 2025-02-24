import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { EmailTemplateVariable } from "../../services/email-templates.service";

@Entity("sys_email_templates")
export class EmailTemplate {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column()
  subject!: string;

  @Column({ type: "text" })
  body!: string;

  @Column({
    type: "text",
    transformer: {
      to: (value: Record<string, EmailTemplateVariable>) => JSON.stringify(value),
      from: (value: string) => JSON.parse(value),
    }
  })
  variables!: Record<string, EmailTemplateVariable>;

  @Column({ name: "created_by" })
  createdBy!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
} 