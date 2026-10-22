import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { subHours } from 'date-fns';
import { Repository } from 'typeorm';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { PrEventType } from '@/domains/pull-requests/pr-enums';
import { RelayCommand } from '@/domains/ingestion/github-event-normalizer.service';
import { GitHubClient } from '@/infrastructure/clients/github.client';
import { LoggerService } from '@/infrastructure/logging/logger.service';
import { numberSetting } from '@/core/config/config-number';
import {
  CandidateStats,
  CandidateStatsService,
} from './candidate-stats.service';
import { AssignmentActionsService } from './assignment-actions.service';
import { AppSettingsService } from './app-settings.service';

export type CommandOutcome = 'assigned' | 'skipped' | 'refused' | 'not-author';

export type CommandSummary = {
  assigned: number;
  skipped: number;
  refused: number;
  notAuthor: number;
};

type CommandResult = { outcome: CommandOutcome; reason?: string };
type HandledCommand = CommandResult & { login?: string };

@Injectable()
export class RelayCommandService {
  constructor(
    @InjectRepository(PrEvent)
    private readonly eventRepo: Repository<PrEvent>,
    private readonly candidateStats: CandidateStatsService,
    private readonly actions: AssignmentActionsService,
    private readonly appSettings: AppSettingsService,
    private readonly github: GitHubClient,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async processPending(now: Date = new Date()): Promise<CommandSummary> {
    const summary: CommandSummary = {
      assigned: 0,
      skipped: 0,
      refused: 0,
      notAuthor: 0,
    };
    const maxAgeHours = numberSetting(
      this.configService,
      'COMMAND_MAX_AGE_HOURS',
      24,
    );
    const pending = await this.eventRepo
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.pullRequest', 'pr')
      .where('event.type = :type', { type: PrEventType.COMMENT })
      .andWhere(`event.payload->>'command' IS NOT NULL`)
      .andWhere(`event.payload->>'handledAt' IS NULL`)
      .andWhere('event."occurredAt" >= :since', {
        since: subHours(now, maxAgeHours),
      })
      .orderBy('event."occurredAt"', 'ASC')
      .getMany();
    if (pending.length === 0) {
      return summary;
    }

    const stats = await this.candidateStats.build(now);
    const live = await this.appSettings.actuallyAssign();
    for (const event of pending) {
      if (!(await this.claim(event.id, now))) {
        continue;
      }
      const { login, ...result } = await this.handle(event, stats);
      await this.mergePayload(event.id, result);
      if (live) {
        await this.reply(event, result, login);
      }
      if (result.outcome === 'not-author') {
        summary.notAuthor += 1;
      } else {
        summary[result.outcome] += 1;
      }
    }
    return summary;
  }

  private async handle(
    event: PrEvent,
    stats: CandidateStats,
  ): Promise<HandledCommand> {
    const pr = event.pullRequest;
    const commenter = stats.personByLogin.get(
      (event.actorLogin ?? '').toLowerCase(),
    );
    const author = stats.personByLogin.get(pr.authorLogin.toLowerCase());
    if (!commenter || !author || commenter.personId !== author.personId) {
      return { outcome: 'not-author' };
    }

    const command = event.payload?.command as RelayCommand;
    if (command === 'skip') {
      return { outcome: 'skipped' };
    }
    try {
      const assignment = await this.actions.assign(
        pr.repo,
        pr.number,
        author.personId,
        'comment',
      );
      return { outcome: 'assigned', login: assignment.login };
    } catch (error) {
      const reason =
        error instanceof BadRequestException ||
        error instanceof NotFoundException
          ? error.message
          : 'Relay hit an unexpected error while picking a reviewer.';
      this.logger.warn(
        `@relay ${command} refused on ${pr.repo}#${pr.number}: ${(error as Error).message}`,
        RelayCommandService.name,
      );
      return { outcome: 'refused', reason };
    }
  }

  private async reply(
    event: PrEvent,
    result: CommandResult,
    login: string | undefined,
  ): Promise<void> {
    const body = replyText(result, login);
    if (!body) {
      return;
    }
    const pr = event.pullRequest;
    try {
      await this.github.createIssueComment(pr.repo, pr.number, body);
    } catch (error) {
      this.logger.warn(
        `Could not reply on ${pr.repo}#${pr.number}: ${(error as Error).message}`,
        RelayCommandService.name,
      );
    }
  }

  private async claim(eventId: string, now: Date): Promise<boolean> {
    const result = await this.eventRepo
      .createQueryBuilder()
      .update(PrEvent)
      .set({ payload: () => `payload || CAST(:claim AS jsonb)` })
      .setParameter('claim', JSON.stringify({ handledAt: now.toISOString() }))
      .where(`id = :id AND payload->>'handledAt' IS NULL`, { id: eventId })
      .execute();
    return !!result.affected;
  }

  private async mergePayload(
    eventId: string,
    patch: CommandResult,
  ): Promise<void> {
    await this.eventRepo
      .createQueryBuilder()
      .update(PrEvent)
      .set({ payload: () => `payload || CAST(:patch AS jsonb)` })
      .setParameter('patch', JSON.stringify(patch))
      .where('id = :id', { id: eventId })
      .execute();
  }
}

function replyText(
  result: CommandResult,
  login: string | undefined,
): string | null {
  switch (result.outcome) {
    case 'assigned':
      return `Requested a review from @${login}, a good fit for this change.`;
    case 'skipped':
      return 'Got it. Relay will stay off this pull request.';
    case 'refused':
      return `Relay didn't pick a reviewer: ${result.reason}`;
    case 'not-author':
      return null;
  }
}
