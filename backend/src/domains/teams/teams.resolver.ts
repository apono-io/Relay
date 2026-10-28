import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { RequirePermissions } from '@/core/rbac/require-permissions.decorator';
import { Permissions } from '@/core/rbac/permissions.constants';
import { TeamsService } from './teams.service';
import {
  TeamMembersResult,
  TeamModel,
  UpdateTeamInput,
} from './models/team.model';

@Resolver(() => TeamModel)
export class TeamsResolver {
  constructor(private readonly teams: TeamsService) {}

  @Query(() => [TeamModel], { name: 'teams' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  teamList(): Promise<TeamModel[]> {
    return this.teams.list();
  }

  @Mutation(() => TeamModel, { name: 'createTeam' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  createTeam(@Args('name') name: string): Promise<TeamModel> {
    return this.teams.create(name);
  }

  @Mutation(() => TeamModel, { name: 'updateTeam' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  updateTeam(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateTeamInput,
  ): Promise<TeamModel> {
    return this.teams.update(id, input);
  }

  @Mutation(() => Boolean, { name: 'deleteTeam' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  deleteTeam(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.teams.remove(id);
  }

  @Mutation(() => TeamMembersResult, { name: 'setTeamMembers' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  async setTeamMembers(
    @Args('teamId', { type: () => ID }) teamId: string,
    @Args('personIds', { type: () => [ID] }) personIds: string[],
  ): Promise<TeamMembersResult> {
    const { team, moved } = await this.teams.setMembers(teamId, personIds);
    return { team, movedPersonIds: moved };
  }
}
