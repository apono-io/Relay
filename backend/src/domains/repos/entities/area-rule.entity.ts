import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import {
  ObjectType,
  Field,
  ID,
  Int,
  GraphQLISODateTime,
} from '@nestjs/graphql';

@ObjectType('AreaRule')
@Entity('area_rules')
@Unique(['repo', 'pattern'])
export class AreaRule {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column()
  repo: string;

  @Field()
  @Column()
  pattern: string;

  @Field()
  @Column()
  area: string;

  @Field(() => Int)
  @Column({ default: 2 })
  risk: number;

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  @UpdateDateColumn()
  updatedAt: Date;
}
