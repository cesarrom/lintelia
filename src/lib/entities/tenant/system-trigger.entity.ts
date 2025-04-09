import { TriggerDefinition, type TriggerAction, type TriggerPattern } from '@/lib/triggers-utils';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { v4 as uuid } from 'uuid';

@Entity('sys_system_triggers')
export class SystemTrigger {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: true, name: 'is_active' })
  isActive!: boolean;

  @Column({ type: 'jsonb' })
  pattern!: TriggerPattern;

  @Column({ type: 'jsonb' })
  action!: TriggerAction;

  @Column({ name: 'created_by' })
  createdBy!: string;

  @Column({ name: 'workflow_id', type: 'uuid' })
  workflowId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  static fromTriggerDefinition(trigger: TriggerDefinition, {
    createdBy,
    workflowId,
    active,
  }: {
    createdBy: string;
    workflowId: string;
    active: boolean
  }): SystemTrigger {
    return Object.assign(new SystemTrigger(), {
      id: trigger.id || uuid(),
      name: trigger.name,
      description: trigger.description,
      isActive: active,
      pattern: trigger.pattern,
      action: trigger.action,
      createdBy: createdBy,
      workflowId: workflowId,
    });
  }
} 