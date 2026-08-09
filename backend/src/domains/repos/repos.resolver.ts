import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Repo } from './entities/repo.entity';
import { AreaRule } from './entities/area-rule.entity';
import { ReposService } from './repos.service';
import {
  AddAreaRuleInput,
  UpdateAreaRuleInput,
} from './models/area-rule-input.model';
import { BackfillService } from '@/domains/ingestion/backfill.service';
import { LoggerService } from '@/infrastructure/logging/logger.service';
import { RequirePermissions } from '@/core/rbac/require-permissions.decorator';
import { Permissions } from '@/core/rbac/permissions.constants';

@Resolver(() => Repo)
export class ReposResolver {
  constructor(
    private readonly repos: ReposService,
    private readonly backfill: BackfillService,
    private readonly logger: LoggerService,
  ) {}

  @Query(() => [Repo], { name: 'repos' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  repoList(): Promise<Repo[]> {
    return this.repos.list();
  }

  @Mutation(() => Repo, { name: 'addRepo' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  async addRepo(@Args('name') name: string): Promise<Repo> {
    const repo = await this.repos.add(name);
    this.backfill.runRepo(repo.name).catch((error: Error) => {
      this.logger.error(
        `Backfill for ${repo.name} failed: ${error.message}`,
        error.stack,
        ReposResolver.name,
      );
    });
    return repo;
  }

  @Query(() => [AreaRule], { name: 'areaRules' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  areaRules(@Args('repo') repo: string): Promise<AreaRule[]> {
    return this.repos.areaRules(repo);
  }

  @Mutation(() => AreaRule, { name: 'addAreaRule' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  addAreaRule(@Args('input') input: AddAreaRuleInput): Promise<AreaRule> {
    return this.repos.addAreaRule(input);
  }

  @Mutation(() => AreaRule, { name: 'updateAreaRule' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  updateAreaRule(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateAreaRuleInput,
  ): Promise<AreaRule> {
    return this.repos.updateAreaRule(id, input);
  }

  @Mutation(() => Boolean, { name: 'deleteAreaRule' })
  @RequirePermissions(Permissions.SETTINGS_ADMIN)
  deleteAreaRule(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.repos.deleteAreaRule(id);
  }
}
