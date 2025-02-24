import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WorkflowExecution } from './workflow-execution.entity';

@Entity('sys_workflow_execution_listeners')
export class WorkflowExecutionListener {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'execution_id' })
  executionId!: string;

  @ManyToOne(() => WorkflowExecution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'execution_id' })
  execution!: WorkflowExecution;

  @Column({ name: 'listener_id' })
  listenerId!: string;

  @Column()
  event!: string;

  @Column({ name: 'source_id', nullable: true })
  sourceId!: string;

  @Column({ name: 'source_type' })
  sourceType!: string;

  @Column({ default: 'waiting' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
} 