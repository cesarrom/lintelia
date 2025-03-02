import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WorkflowNodeExecution } from './workflow-node-execution.entity';

export type ReviewStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'additional_data_requested';

@Entity('sys_reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'node_execution_id' })
  nodeExecutionId!: string;

  @ManyToOne(() => WorkflowNodeExecution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'node_execution_id' })
  nodeExecution!: WorkflowNodeExecution;

  @Column()
  title!: string;

  @Column({ nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'in_progress', 'approved', 'rejected', 'additional_data_requested'],
    default: 'pending'
  })
  status!: ReviewStatus;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo?: string;

  @Column({ name: 'assigned_at', nullable: true })
  assignedAt?: Date;

  @Column({ name: 'completed_by', nullable: true })
  completedBy?: string;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ nullable: true })
  comments?: string;

  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason?: string;

  @Column({ name: 'additional_data_request', nullable: true })
  additionalDataRequest?: string;

  @Column({
    type: 'jsonb',
    name: 'review_items',
    default: []
  })
  reviewItems!: Array<{
    answer_id: string;
    label?: string;
    status: 'pending' | 'approved' | 'rejected';
    comments?: string;
  }>;

  @Column({
    type: 'jsonb',
    name: 'evidence',
    nullable: true
  })
  evidence?: Array<{
    type: string;
    url: string;
    name: string;
    description?: string;
  }>;

  @Column({ name: 'due_date', nullable: true })
  dueDate?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
} 