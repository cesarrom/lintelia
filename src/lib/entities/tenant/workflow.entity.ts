import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sys_workflows')
export class Workflow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ default: 1 })
  version!: number;

  @Column({ length: 255 })
  description!: string;

  @Column({ type: 'text' })
  yaml!: string;

  @Column({ name: 'allowed_roles', type: 'simple-array' })
  allowedRoles!: string[];

  @Column({ name: 'allowed_users', type: 'simple-array' })
  allowedUsers!: string[];

  @Column({ default: 'draft' })
  status!: 'draft' | 'active' | 'archived';

  @Column({ name: 'created_by' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
} 