import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { GithubIdentity } from './github-identity.entity';

@ObjectType('Person')
@Entity('people')
export class Person {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ unique: true })
  email: string;

  @Field(() => String, { nullable: true })
  @Index({ unique: true, where: '"githubLogin" IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  githubLogin?: string | null;

  @Field({ nullable: true })
  @Column({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  team?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  timezone?: string;

  @Field()
  @Column({ default: 'developer' })
  role: string;

  @Field()
  @Column({ default: true })
  active: boolean;

  @Field(() => [GithubIdentity])
  @OneToMany(() => GithubIdentity, (identity) => identity.person)
  identities: GithubIdentity[];

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
