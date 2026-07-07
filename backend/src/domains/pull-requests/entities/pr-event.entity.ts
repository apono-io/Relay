import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ObjectType, Field, ID, GraphQLISODateTime } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { PrEventType, PrEventSource } from '../pr-enums';
import { PullRequest } from './pull-request.entity';

@ObjectType('PrEvent')
@Entity('pr_events')
export class PrEvent {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Index()
  @Column()
  prId: string;

  @ManyToOne(() => PullRequest, (pr) => pr.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prId' })
  pullRequest: PullRequest;

  @Field(() => PrEventType)
  @Column({ type: 'varchar' })
  type: PrEventType;

  @Field({ nullable: true })
  @Column({ nullable: true })
  actorLogin?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown>;

  @Field(() => GraphQLISODateTime)
  @Index()
  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @Field(() => PrEventSource)
  @Column({ type: 'varchar' })
  source: PrEventSource;

  @Field()
  @Index({ unique: true })
  @Column()
  externalId: string;

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn()
  createdAt: Date;
}
