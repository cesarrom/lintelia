import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sys_invitations')
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'role_id' })
  roleId!: string;

  @Column({
    name: 'data', type: 'text', transformer: {
      to: (value: Record<string, unknown>) => JSON.stringify(value),
      from: (value: string) => JSON.parse(value)
    }
  })
  data!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
} 