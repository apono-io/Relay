import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { ObjectType, Field, ID, GraphQLISODateTime } from '@nestjs/graphql';

@ObjectType('Repo')
@Entity('repos')
@Unique(['name'])
export class Repo {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  name: string;

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn()
  createdAt: Date;
}
