import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

// One row per person, so a person belongs to one team at most.
@Entity('team_members')
export class TeamMember {
  @PrimaryColumn('uuid')
  personId: string;

  @Index()
  @Column('uuid')
  teamId: string;
}
