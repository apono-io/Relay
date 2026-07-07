import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType('Person')
@Entity('people')
export class Person {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ unique: true })
  email: string;

  @Field({ nullable: true })
  @Index({ unique: true, where: '"githubLogin" IS NOT NULL' })
  @Column({ nullable: true })
  githubLogin?: string;

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

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
