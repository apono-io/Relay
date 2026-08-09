import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { CandidateSignals } from '../assignment-engine';

export type SuggestionPick = {
  personId: string;
  displayName: string;
  login: string;
  reason: string;
  signals?: CandidateSignals;
};

@Entity('suggestions')
export class Suggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  prId: string;

  @Index()
  @Column()
  repo: string;

  @Column()
  prNumber: number;

  @Column({ type: 'varchar', nullable: true })
  area?: string | null;

  @Column()
  risk: number;

  @Column({ type: 'jsonb', default: [] })
  picks: SuggestionPick[];

  @Column({ type: 'timestamptz' })
  generatedAt: Date;

  @Column('text', { array: true, default: [] })
  actualLogins: string[];

  @Column({ type: 'boolean', nullable: true })
  matched?: boolean | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  assignedLogin?: string | null;

  @Column({ type: 'varchar', nullable: true })
  assignedName?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  assignedAt?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  assignedByPersonId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  assignedTrigger?: string | null;

  @Column({ type: 'varchar', nullable: true })
  assignedReason?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  assignedSignals?: CandidateSignals | null;

  @Column({ type: 'boolean', nullable: true })
  shadow?: boolean | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
