import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Workflow } from './workflow.entity';

@Entity('sys_workflow_executions')
export class WorkflowExecution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workflow_id' })
  workflowId!: string;

  @ManyToOne(() => Workflow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow!: Workflow;

  @Column({ default: 'pending' })
  status!: 'pending' | 'running' | 'completed' | 'failed';

  @Column({ name: 'started_at', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ name: 'execution_node_id', nullable: true })
  executionNodeId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
} 