import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

@InputType()
export class AddAreaRuleInput {
  @Field()
  @IsString()
  @MaxLength(140)
  repo: string;

  @Field()
  @IsString()
  @MaxLength(200)
  pattern: string;

  @Field()
  @IsString()
  @MaxLength(60)
  area: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(5)
  risk: number;
}

@InputType()
export class UpdateAreaRuleInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pattern?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  area?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  risk?: number;
}
