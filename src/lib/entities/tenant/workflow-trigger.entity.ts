import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Workflow } from './workflow.entity';

@Entity('sys_workflow_triggers')
export class WorkflowTrigger {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workflow_id' })
  workflowId!: string;

  @ManyToOne(() => Workflow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow!: Workflow;

  @Column({ length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  type!: string; // e.g. 'form', 'api', 'database', 'user', etc.

  @Column({ name: 'event_name' })
  eventName!: string; // e.g. 'form.submitted', 'user.created', etc.

  @Column({ type: 'text' })
  config!: string; // JSON string of trigger-specific configuration

  @Column({ default: 'active' })
  status!: 'active' | 'inactive';

  @Column({ name: 'created_by' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
} 