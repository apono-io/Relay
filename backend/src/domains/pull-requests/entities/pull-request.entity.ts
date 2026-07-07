import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, OneToMany, Unique } from 'typeorm';
import { ObjectType, Field, ID, Int, Float, GraphQLISODateTime } from '@nestjs/graphql';
import { PrEvent } from './pr-event.entity';
import { PrState, WaitingOn, CheckState, PrSize } from '../pr-enums';

@ObjectType('PullRequest')
@Entity('pull_requests')
@Unique(['repo', 'number'])
export class PullRequest {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column()
  repo: string;

  @Field(() => Int)
  @Column()
  number: number;

  @Field()
  @Column()
  title: string;

  @Field()
  @Column()
  url: string;

  @Field(() => PrSize, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  size?: PrSize;

  @Field()
  @Index()
  @Column()
  authorLogin: string;

  @Field(() => PrState)
  @Column({ type: 'varchar', default: PrState.OPEN })
  state: PrState;

  @Field()
  @Column({ default: false })
  isDraft: boolean;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  firstCommitAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  openedAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  readyAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  firstReviewAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastCommitAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  mergedAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  closedAt?: Date;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'double precision', nullable: true })
  codingTime?: number;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'double precision', nullable: true })
  pickupTime?: number;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'double precision', nullable: true })
  reworkTime?: number;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'double precision', nullable: true })
  mergeTime?: number;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'double precision', nullable: true })
  cycleTime?: number;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'double precision', nullable: true })
  leadTime?: number;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'double precision', nullable: true })
  reviewerWaitTime?: number;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'double precision', nullable: true })
  authorWaitTime?: number;

  @Field(() => Int)
  @Column({ default: 0 })
  reworkCycles: number;

  @Field()
  @Column({ default: false })
  isRevert: boolean;

  @Field()
  @Column({ default: false })
  isBot: boolean;

  @Field(() => Int)
  @Column({ default: 0 })
  reviewCommentCount: number;

  @Field()
  @Column({ default: false })
  approvedWithZeroComments: boolean;

  @Field(() => CheckState, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  checkState?: CheckState;

  @Field(() => WaitingOn)
  @Column({ type: 'varchar', default: WaitingOn.NONE })
  waitingOn: WaitingOn;

  @Field(() => [String])
  @Column('text', { array: true, default: [] })
  requestedReviewers: string[];

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  reviewDueAt?: Date;

  @Column({ type: 'jsonb', default: [] })
  waitRounds: { round: number; reviewerWaitSeconds: number | null; authorWaitSeconds: number | null }[];

  @OneToMany(() => PrEvent, (event) => event.pullRequest)
  events: PrEvent[];

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  @UpdateDateColumn()
  updatedAt: Date;
}
