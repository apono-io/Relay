import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { Person } from './person.entity';

export enum IdentitySource {
  COMMIT_EMAIL = 'commit_email',
  MANUAL = 'manual',
  GITHUB_OAUTH = 'github_oauth',
}

registerEnumType(IdentitySource, { name: 'IdentitySource' });

const SOURCE_RANK: Record<IdentitySource, number> = {
  [IdentitySource.COMMIT_EMAIL]: 1,
  [IdentitySource.MANUAL]: 2,
  [IdentitySource.GITHUB_OAUTH]: 3,
};

export function sourceRank(source: IdentitySource): number {
  return SOURCE_RANK[source] ?? 0;
}

export function outranks(
  incoming: IdentitySource,
  stored: IdentitySource,
): boolean {
  return sourceRank(incoming) >= sourceRank(stored);
}

export function canTakeFromAnotherPerson(
  incoming: IdentitySource,
  stored: IdentitySource,
): boolean {
  return stored !== IdentitySource.GITHUB_OAUTH && outranks(incoming, stored);
}

@ObjectType('GithubIdentity')
@Entity('github_identities')
export class GithubIdentity {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  personId: string;

  @ManyToOne(() => Person, (person) => person.identities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'personId' })
  person?: Person;

  @Field()
  @Column({ unique: true })
  login: string;

  @Field(() => IdentitySource)
  @Column({ type: 'varchar' })
  source: IdentitySource;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
