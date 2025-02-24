import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('environments')
export class Environment {
  @PrimaryColumn({ length: 255 })
  name!: string;

  @Column({ name: 'distribution_arn' })
  distributionArn!: string;
} 