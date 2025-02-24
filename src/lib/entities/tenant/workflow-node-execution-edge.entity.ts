import { Entity, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WorkflowNodeExecution } from './workflow-node-execution.entity';

@Entity('sys_workflow_node_executions_edges')
export class WorkflowNodeExecutionEdge {
  @Column({ name: 'execution_id' })
  executionId!: string;

  @Column({ name: 'node_execution_id', primary: true })
  nodeExecutionId!: string;

  @ManyToOne(() => WorkflowNodeExecution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'node_execution_id' })
  nodeExecution!: WorkflowNodeExecution;

  @Column({ name: 'event_name', primary: true })
  eventName!: string;

  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      to: (value: Record<string, unknown> | null) => value ? JSON.stringify(value) : null,
      from: (value: string | null) => value ? JSON.parse(value) : null,
    }
  })
  result?: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
} 