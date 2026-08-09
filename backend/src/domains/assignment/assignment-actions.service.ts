import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { subDays, subMinutes } from 'date-fns';
import { In, IsNull, Not, Repository } from 'typeorm';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { isBotReviewer } from '@/domains/pull-requests/phase-computer.service';
import { PrEventType, PrState } from '@/domains/pull-requests/pr-enums';
import { GitHubClient } from '@/infrastructure/clients/github.client';
import { LoggerService } from '@/infrastructure/logging/logger.service';
import { numberSetting } from '@/core/config/config-number';
import { Suggestion } from './entities/suggestion.entity';
import { AssignmentEngine, DEFAULT_ENGINE_CONFIG } from './assignment-engine';
import {
  CandidateStats,
  CandidateStatsService,
} from './candidate-stats.service';
import { AppSettingsService } from './app-settings.service';
import { RelayAssignment } from './models/relay-assignment.model';

@Injectable()
export class AssignmentActionsService {
  constructor(
    @InjectRepository(Suggestion)
    private readonly suggestionRepo: Repository<Suggestion>,
    @InjectRepository(PullRequest)
    private readonly prRepo: Repository<PullRequest>,
    @InjectRepository(PrEvent)
    private readonly eventRepo: Repository<PrEvent>,
    private readonly candidateStats: CandidateStatsService,
    private readonly appSettings: AppSettingsService,
    private readonly github: GitHubClient,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async assign(
    repo: string,
    number: number,
    byPersonId: string | null,
  ): Promise<RelayAssignment> {
    const pr = await this.prRepo.findOne({ where: { repo, number } });
    if (!pr) {
      throw new NotFoundException(`Relay does not know ${repo}#${number}.`);
    }
    const stats = await this.candidateStats.build();
    return this.assignWithStats(pr, stats, byPersonId, 'manual', new Date());
  }

  async autoAssign(now: Date = new Date()): Promise<number> {
    const graceMinutes = numberSetting(
      this.configService,
      'ASSIGNMENT_GRACE_MINUTES',
      15,
    );
    const maxAgeDays = numberSetting(
      this.configService,
      'SUGGESTION_MAX_PR_AGE_DAYS',
      7,
    );
    const stats = await this.candidateStats.build(now);
    const autoPersonIds = new Set(
      Array.from(stats.modeByPersonId.entries())
        .filter(([, mode]) => mode === 'auto')
        .map(([personId]) => personId),
    );
    if (autoPersonIds.size === 0) {
      return 0;
    }

    const targets = await this.prRepo
      .createQueryBuilder('pr')
      .where('pr.state = :state', { state: PrState.OPEN })
      .andWhere('pr."isDraft" = false')
      .andWhere('pr."isBot" = false')
      .andWhere('cardinality(pr."requestedReviewers") = 0')
      .andWhere('pr."firstReviewAt" IS NULL')
      .andWhere('COALESCE(pr."openedAt", pr."createdAt") <= :grace', {
        grace: subMinutes(now, graceMinutes),
      })
      .andWhere('COALESCE(pr."openedAt", pr."createdAt") >= :freshCutoff', {
        freshCutoff: subDays(now, maxAgeDays),
      })
      .orderBy('COALESCE(pr."openedAt", pr."createdAt")', 'ASC')
      .getMany();

    const alreadyAssigned = await this.suggestionRepo.find({
      where: { assignedAt: Not(IsNull()) },
      select: ['prId'],
    });
    const assignedPrIds = new Set(alreadyAssigned.map((row) => row.prId));

    let assigned = 0;
    for (const pr of targets) {
      if (assignedPrIds.has(pr.id)) {
        continue;
      }
      const author = stats.personByLogin.get(pr.authorLogin.toLowerCase());
      if (!author || !autoPersonIds.has(author.personId)) {
        continue;
      }
      try {
        const result = await this.assignWithStats(
          pr,
          stats,
          author.personId,
          'auto',
          now,
        );
        const picked = stats.candidates.find((candidate) =>
          candidate.logins.some(
            (login) => login.toLowerCase() === result.login.toLowerCase(),
          ),
        );
        if (picked) {
          picked.openReviewRequests += 1;
          picked.activeRelayPicks += 1;
        }
        assigned += 1;
      } catch (error) {
        this.logger.warn(
          `Auto-assign skipped ${pr.repo}#${pr.number}: ${(error as Error).message}`,
          AssignmentActionsService.name,
        );
      }
    }
    return assigned;
  }

  private async assignWithStats(
    pr: PullRequest,
    stats: CandidateStats,
    byPersonId: string | null,
    trigger: 'manual' | 'auto',
    now: Date,
  ): Promise<RelayAssignment> {
    if (pr.state !== PrState.OPEN) {
      throw new BadRequestException('This pull request is no longer open.');
    }
    if (pr.isDraft) {
      throw new BadRequestException('Drafts do not get a reviewer.');
    }
    if (pr.requestedReviewers.length > 0) {
      throw new BadRequestException(
        'This pull request already has a requested reviewer on GitHub.',
      );
    }
    if (await this.hasHumanReview(pr)) {
      throw new BadRequestException(
        'Someone already reviewed this pull request — review is in progress, no pick needed.',
      );
    }

    const existing = await this.suggestionRepo.findOne({
      where: { prId: pr.id },
    });
    if (existing?.assignedAt) {
      throw new BadRequestException(
        `Relay already assigned ${existing.assignedName ?? existing.assignedLogin} to this pull request.`,
      );
    }

    const rules = stats.rulesByRepo[pr.repo] ?? [];
    const area = AssignmentEngine.classify(pr.filePaths, rules);
    const author = stats.personByLogin.get(pr.authorLogin.toLowerCase());
    const result = AssignmentEngine.rank({
      authorPersonId: author?.personId ?? null,
      authorLogin: pr.authorLogin,
      requestedReviewers: pr.requestedReviewers,
      area,
      candidates: stats.candidates,
      config: DEFAULT_ENGINE_CONFIG,
    });
    const pick = result.picks[0];
    if (!pick) {
      throw new BadRequestException(
        'No eligible reviewer right now — everyone is filtered out for this pull request.',
      );
    }

    const actuallyAssign = await this.appSettings.actuallyAssign();
    if (actuallyAssign) {
      const authorMode = author
        ? (stats.modeByPersonId.get(author.personId) ?? 'off')
        : 'off';
      if (authorMode === 'off') {
        throw new BadRequestException(
          'The author has assignment turned off, so Relay will not assign on GitHub.',
        );
      }
    }

    if (!existing) {
      await this.suggestionRepo
        .createQueryBuilder()
        .insert()
        .values({
          prId: pr.id,
          repo: pr.repo,
          prNumber: pr.number,
          area: area.area,
          risk: area.risk,
          picks: result.picks,
          generatedAt: now,
        })
        .orIgnore()
        .execute();
    }

    const claim = await this.suggestionRepo
      .createQueryBuilder()
      .update()
      .set({
        area: area.area,
        risk: area.risk,
        assignedLogin: pick.login,
        assignedName: pick.displayName,
        assignedAt: now,
        assignedByPersonId: byPersonId,
        assignedTrigger: trigger,
        shadow: !actuallyAssign,
        assignedReason: pick.reason,
        assignedSignals: pick.signals ?? null,
      })
      .where('"prId" = :prId AND "assignedAt" IS NULL', { prId: pr.id })
      .execute();
    if (!claim.affected) {
      throw new BadRequestException(
        'Relay already assigned a reviewer to this pull request.',
      );
    }

    if (actuallyAssign) {
      try {
        await this.github.requestReviewers(pr.repo, pr.number, [pick.login]);
      } catch (error) {
        await this.releaseClaim(pr.id);
        throw error;
      }
    }

    return {
      repo: pr.repo,
      number: pr.number,
      login: pick.login,
      displayName: pick.displayName,
      shadow: !actuallyAssign,
      trigger,
      assignedAt: now,
      area: area.area,
      reason: pick.reason,
      signals: pick.signals ?? null,
    };
  }

  private async hasHumanReview(pr: PullRequest): Promise<boolean> {
    const rows = await this.eventRepo
      .createQueryBuilder('event')
      .select('event.actorLogin', 'actorLogin')
      .distinct(true)
      .where('event."prId" = :prId', { prId: pr.id })
      .andWhere('event.type = :type', { type: PrEventType.REVIEW_SUBMITTED })
      .andWhere('event."actorLogin" IS NOT NULL')
      .getRawMany<{ actorLogin: string }>();
    const bots = new Set(
      (
        this.configService.get<string>('GITHUB_BOT_REVIEWERS') ??
        'github-code-quality,claude,copilot-pull-request-reviewer'
      )
        .split(',')
        .map((login) => login.trim().toLowerCase())
        .filter(Boolean),
    );
    const author = pr.authorLogin.toLowerCase();
    return rows.some(
      (row) =>
        !isBotReviewer(row.actorLogin, bots) &&
        row.actorLogin.toLowerCase() !== author,
    );
  }

  async reset(repo: string, number: number): Promise<boolean> {
    const row = await this.suggestionRepo.findOne({
      where: { repo, prNumber: number },
    });
    if (!row?.assignedAt || !row.assignedLogin) {
      throw new BadRequestException(
        `Relay has no assignment to reset on ${repo}#${number}.`,
      );
    }
    if (row.shadow === false) {
      const pr = await this.prRepo.findOne({ where: { repo, number } });
      const stillRequested =
        pr?.requestedReviewers.some(
          (login) => login.toLowerCase() === row.assignedLogin!.toLowerCase(),
        ) ?? false;
      if (stillRequested) {
        await this.github.removeRequestedReviewers(repo, number, [
          row.assignedLogin,
        ]);
      }
    }
    await this.releaseClaim(row.prId);
    return true;
  }

  private async releaseClaim(prId: string): Promise<void> {
    await this.suggestionRepo.update(
      { prId },
      {
        assignedLogin: null,
        assignedName: null,
        assignedAt: null,
        assignedByPersonId: null,
        assignedTrigger: null,
        shadow: null,
        assignedReason: null,
        assignedSignals: null,
      },
    );
  }

  async activeAssignments(): Promise<RelayAssignment[]> {
    const rows = await this.suggestionRepo.find({
      where: { assignedAt: Not(IsNull()) },
    });
    if (rows.length === 0) {
      return [];
    }
    const prs = await this.prRepo.find({
      where: { id: In(rows.map((row) => row.prId)) },
      select: ['id', 'state', 'requestedReviewers'],
    });
    const prById = new Map(prs.map((pr) => [pr.id, pr]));
    return rows
      .filter((row) => {
        const pr = prById.get(row.prId);
        return (
          pr &&
          pr.state === PrState.OPEN &&
          pr.requestedReviewers.length === 0 &&
          row.assignedLogin
        );
      })
      .map((row) => {
        const pick = row.picks.find((p) => p.login === row.assignedLogin);
        return {
          repo: row.repo,
          number: row.prNumber,
          login: row.assignedLogin!,
          displayName: row.assignedName ?? row.assignedLogin!,
          shadow: row.shadow ?? true,
          trigger: row.assignedTrigger ?? 'manual',
          assignedAt: row.assignedAt!,
          area: row.area,
          reason: row.assignedReason ?? pick?.reason ?? null,
          signals: row.assignedSignals ?? pick?.signals ?? null,
        };
      });
  }
}
