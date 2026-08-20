import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/core/auth/models/auth-user.model';
import { RequirePermissions } from '@/core/rbac/require-permissions.decorator';
import { Permissions } from '@/core/rbac/permissions.constants';
import { PeopleService } from '@/domains/people/people.service';
import { SuggestionService } from './suggestion.service';
import { AssignmentActionsService } from './assignment-actions.service';
import { AppSettingsService } from './app-settings.service';
import { AssignmentComparison } from './models/assignment-comparison.model';
import { AssignmentPerformance } from './models/assignment-performance.model';
import { AssignmentPerformanceService } from './assignment-performance.service';
import {
  AssignmentSettings,
  RelayAssignment,
} from './models/relay-assignment.model';

@Resolver(() => AssignmentComparison)
export class AssignmentResolver {
  constructor(
    private readonly suggestions: SuggestionService,
    private readonly actions: AssignmentActionsService,
    private readonly appSettings: AppSettingsService,
    private readonly people: PeopleService,
    private readonly performanceService: AssignmentPerformanceService,
  ) {}

  @Query(() => AssignmentComparison, { name: 'assignmentComparison' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  assignmentComparison(): Promise<AssignmentComparison> {
    return this.suggestions.comparison();
  }

  @Query(() => AssignmentPerformance, { name: 'assignmentPerformance' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  assignmentPerformance(): Promise<AssignmentPerformance> {
    return this.performanceService.performance();
  }

  @Query(() => [RelayAssignment], { name: 'relayAssignments' })
  @RequirePermissions(Permissions.DASHBOARD_READ)
  relayAssignments(): Promise<RelayAssignment[]> {
    return this.actions.activeAssignments();
  }

  @Mutation(() => RelayAssignment, { name: 'assignReviewer' })
  @RequirePermissions(Permissions.ASSIGNMENT_TRIGGER)
  async assignReviewer(
    @CurrentUser() user: AuthenticatedUser,
    @Args('repo') repo: string,
    @Args('number', { type: () => Int }) number: number,
  ): Promise<RelayAssignment> {
    const person = await this.people.findByEmail(user.email);
    return this.actions.assign(repo, number, person?.id ?? null);
  }

  @Mutation(() => Boolean, { name: 'resetAssignment' })
  @RequirePermissions(Permissions.ASSIGNMENT_TRIGGER)
  resetAssignment(
    @Args('repo') repo: string,
    @Args('number', { type: () => Int }) number: number,
  ): Promise<boolean> {
    return this.actions.reset(repo, number);
  }

  @Query(() => AssignmentSettings, { name: 'assignmentSettings' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  async assignmentSettings(): Promise<AssignmentSettings> {
    return { actuallyAssign: await this.appSettings.actuallyAssign() };
  }

  @Mutation(() => AssignmentSettings, { name: 'setActuallyAssign' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  async setActuallyAssign(
    @Args('enabled') enabled: boolean,
  ): Promise<AssignmentSettings> {
    return {
      actuallyAssign: await this.appSettings.setActuallyAssign(enabled),
    };
  }
}
