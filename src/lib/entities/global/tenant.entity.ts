import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 255, unique: true })
  domain!: string;

  @Column({ name: 'logo_url', length: 255 })
  logoUrl!: string;

  @Column({ type: 'jsonb' })
  pallette!: {
    primary: string;
    secondary: string;
    accent: string;
  };

  @Column({ name: 'allowed_domains', type: 'text', array: true, default: '[]' })
  allowedDomains: string[] = [];

  @Column({ name: 'database_id' })
  databaseId!: string;

  @Column({ name: 'database_url' })
  databaseUrl!: string;

  @Column({ name: 'database_password' })
  databasePassword!: string;

  @Column({ name: 'address_line_1', length: 255 })
  addressLine1!: string;

  @Column({ name: 'address_line_2', length: 255 })
  addressLine2!: string;

  @Column({ length: 255 })
  city!: string;

  @Column({ length: 255 })
  country!: string;

  @Column({ length: 255 })
  state!: string;

  @Column({ name: 'zip_code', length: 255 })
  zipCode!: string;

  @Column({ name: 'start_working_hour', length: 255 })
  startWorkingHour!: string;

  @Column({ name: 'end_working_hour', length: 255 })
  endWorkingHour!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
} 