import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WorkflowExecution } from './workflow-execution.entity';

@Entity('sys_workflow_node_executions')
export class WorkflowNodeExecution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'execution_id' })
  executionId!: string;

  @ManyToOne(() => WorkflowExecution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'execution_id' })
  execution!: WorkflowExecution;

  @Column({ name: 'previous_node_execution_id', nullable: true })
  previousNodeExecutionId?: string;

  @ManyToOne(() => WorkflowNodeExecution, { nullable: true })
  @JoinColumn({ name: 'previous_node_execution_id' })
  previousNodeExecution?: WorkflowNodeExecution;

  @Column({ name: 'node_id' })
  nodeId!: string;

  @Column({ default: 'pending' })
  status!: 'pending' | 'in_progress' | 'completed' | 'failed';

  @Column({ name: 'started_at', nullable: true })
  startedAt!: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ name: 'executed_by', nullable: true })
  executedBy?: string;

  @Column({ name: 'executed_by_role', nullable: true })
  executedByRole?: string;

  @Column({
    type: 'text',
    transformer: {
      to: (value: Record<string, unknown>) => JSON.stringify(value),
      from: (value: string) => JSON.parse(value),
    }
  })
  config?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
} 