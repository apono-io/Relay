import { NotFoundException } from '@nestjs/common';
import {
  Args,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/core/auth/models/auth-user.model';
import { RequirePermissions } from '@/core/rbac/require-permissions.decorator';
import { Permissions } from '@/core/rbac/permissions.constants';
import { PeopleService } from './people.service';
import { PersonSettingsService } from './person-settings.service';

@ObjectType()
export class MySettings {
  @Field()
  assignmentMode: string;
}

@Resolver(() => MySettings)
export class PersonSettingsResolver {
  constructor(
    private readonly personSettings: PersonSettingsService,
    private readonly people: PeopleService,
  ) {}

  @Query(() => MySettings, { name: 'mySettings' })
  @RequirePermissions(Permissions.SETTINGS_WRITE_OWN)
  async mySettings(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MySettings> {
    const person = await this.people.findByEmail(user.email);
    if (!person) {
      return { assignmentMode: 'off' };
    }
    return { assignmentMode: await this.personSettings.modeFor(person.id) };
  }

  @Mutation(() => MySettings, { name: 'setMyAssignmentMode' })
  @RequirePermissions(Permissions.SETTINGS_WRITE_OWN)
  async setMyAssignmentMode(
    @CurrentUser() user: AuthenticatedUser,
    @Args('mode') mode: string,
  ): Promise<MySettings> {
    const person = await this.people.findByEmail(user.email);
    if (!person) {
      throw new NotFoundException(
        'No person is linked to your account yet — ask an admin to add you in System settings.',
      );
    }
    return {
      assignmentMode: await this.personSettings.setMode(person.id, mode),
    };
  }
}
