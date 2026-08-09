import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export const ASSIGNMENT_MODES = ['off', 'hybrid', 'auto'] as const;
export type AssignmentModeValue = (typeof ASSIGNMENT_MODES)[number];

export function isAssignmentMode(value: string): value is AssignmentModeValue {
  return (ASSIGNMENT_MODES as readonly string[]).includes(value);
}

@Entity('person_settings')
export class PersonSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  personId: string;

  @Column({ type: 'varchar', default: 'off' })
  assignmentMode: AssignmentModeValue;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
