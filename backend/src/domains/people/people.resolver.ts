import { Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Person } from './entities/person.entity';
import { PeopleService } from './people.service';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';

@Resolver(() => Person)
export class PeopleResolver {
  constructor(private readonly peopleService: PeopleService) {}

  @Query(() => [Person], { name: 'people' })
  @UseGuards(JwtAuthGuard)
  people(): Promise<Person[]> {
    return this.peopleService.findAll();
  }
}
