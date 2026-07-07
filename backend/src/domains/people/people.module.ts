import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from './entities/person.entity';
import { PeopleService } from './people.service';
import { PeopleResolver } from './people.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([Person])],
  providers: [PeopleService, PeopleResolver],
  exports: [PeopleService],
})
export class PeopleModule {}
