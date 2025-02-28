import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type SystemVariableType = 'string' | 'number' | 'boolean' | 'json' | 'array';

@Entity('sys_system_variables')
export class SystemVariable {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255, unique: true })
  name!: string;

  @Column({ length: 255 })
  description!: string;

  @Column({
    type: 'enum',
    enum: ['string', 'number', 'boolean', 'json', 'array'],
  })
  type!: SystemVariableType;

  @Column({ type: 'jsonb' })
  value!: any;

  @Column({ default: false })
  isProtected!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
} 