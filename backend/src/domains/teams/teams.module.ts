import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';
import { TeamsService } from './teams.service';
import { TeamsResolver } from './teams.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([Team, TeamMember])],
  providers: [TeamsService, TeamsResolver],
  exports: [TeamsService],
})
export class TeamsModule {}
