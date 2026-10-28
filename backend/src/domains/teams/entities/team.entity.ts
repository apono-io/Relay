import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  name: string;

  // A person leads at most one team.
  @Index({ unique: true })
  @Column({ type: 'uuid', nullable: true })
  leadPersonId: string | null;

  @Column({ default: 2 })
  leadThreshold: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
