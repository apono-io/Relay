import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { Person } from './entities/person.entity';
import { PeopleService } from './people.service';
import { RosterHealth } from './models/roster-health.model';
import { PeopleSyncResult } from './models/people-sync.model';

// The Sync button looks further back than the default seed to find work addresses.
const SYNC_PROBE_DEPTH = 25;
import {
  CreatePersonInput,
  UpdatePersonInput,
} from './models/person-input.model';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '@/core/rbac/require-permissions.decorator';
import { Permissions } from '@/core/rbac/permissions.constants';

@Resolver(() => Person)
export class PeopleResolver {
  constructor(private readonly peopleService: PeopleService) {}

  @Query(() => [Person], { name: 'people' })
  @UseGuards(JwtAuthGuard)
  people(): Promise<Person[]> {
    return this.peopleService.findAll();
  }

  @Query(() => RosterHealth, { name: 'rosterHealth' })
  @RequirePermissions(Permissions.PERSON_READ)
  async rosterHealth(): Promise<RosterHealth> {
    const [unmappedLogins, unresolvedPeople] = await Promise.all([
      this.peopleService.unmappedLogins(),
      this.peopleService.unresolvedIdentities(),
    ]);
    return { unmappedLogins, unresolvedPeople };
  }

  @Mutation(() => PeopleSyncResult, { name: 'syncPeopleFromGithub' })
  @RequirePermissions(Permissions.PERSON_WRITE)
  async syncPeopleFromGithub(): Promise<PeopleSyncResult> {
    const summary = await this.peopleService.seedFromCommitEmails({
      probeDepth: SYNC_PROBE_DEPTH,
    });
    return {
      peopleCreated: summary.peopleCreated,
      identitiesLinked: summary.identitiesLinked,
      stillNeedEmail: summary.unresolved.map((entry) => entry.login),
    };
  }

  @Mutation(() => Person, { name: 'createPerson' })
  @RequirePermissions(Permissions.PERSON_WRITE)
  createPerson(@Args('input') input: CreatePersonInput): Promise<Person> {
    return this.peopleService.create(input);
  }

  @Mutation(() => Person, { name: 'updatePerson' })
  @RequirePermissions(Permissions.PERSON_WRITE)
  async updatePerson(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePersonInput,
  ): Promise<Person> {
    const { active, ...fields } = input;
    const updated = await this.peopleService.update(id, fields);
    if (!updated) {
      throw new NotFoundException(`No person with id ${id}`);
    }
    if (active === undefined) {
      return updated;
    }
    return (await this.peopleService.setActive(id, active))!;
  }

  @Mutation(() => Person, { name: 'setPersonActive' })
  @RequirePermissions(Permissions.PERSON_WRITE)
  async setPersonActive(
    @Args('id', { type: () => ID }) id: string,
    @Args('active') active: boolean,
  ): Promise<Person> {
    const updated = await this.peopleService.setActive(id, active);
    if (!updated) {
      throw new NotFoundException(`No person with id ${id}`);
    }
    return updated;
  }
}
