import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn()
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @UpdateDateColumn()
  updatedAt: Date;
}
