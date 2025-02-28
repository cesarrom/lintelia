import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type LogLevel = 'info' | 'warning' | 'error' | 'debug';
export type LogCategory = 'system' | 'workflow' | 'user' | 'form' | 'security' | 'integration';

@Entity('sys_logs')
export class Log {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  message!: string;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @Column({
    type: 'enum',
    enum: ['info', 'warning', 'error', 'debug'],
    default: 'info'
  })
  level!: LogLevel;

  @Column({
    type: 'enum',
    enum: ['system', 'workflow', 'user', 'form', 'security', 'integration'],
    default: 'system'
  })
  category!: LogCategory;

  @Column({ length: 255, nullable: true })
  source?: string;

  @Column({ length: 255, nullable: true })
  userId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ default: false })
  acknowledged!: boolean;

  @Column({ nullable: true })
  acknowledgedBy?: string;

  @Column({ nullable: true })
  acknowledgedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
} 