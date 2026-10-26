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
import { RelayAssignment } from './models/relay-assignment.model';

export type CommandOutcome =
  'assigned' | 'skipped' | 'refused' | 'not-author' | 'ignored';

export type CommandSummary = {
  assigned: number;
  skipped: number;
  refused: number;
  notAuthor: number;
  ignored: number;
};

const SUMMARY_KEY: Record<CommandOutcome, keyof CommandSummary> = {
  assigned: 'assigned',
  skipped: 'skipped',
  refused: 'refused',
  'not-author': 'notAuthor',
  ignored: 'ignored',
};

const UNKNOWN_ACCOUNT_REASON =
  "Relay doesn't know this GitHub account yet. Link it in Relay under Settings, or ask an admin to add it under System settings → People.";

type CommandResult = { outcome: CommandOutcome; reason?: string };
type PickedReviewer = Pick<
  RelayAssignment,
  'login' | 'area' | 'reason' | 'shadow'
>;
type HandledCommand = CommandResult & { pick?: PickedReviewer };

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
      ignored: 0,
    };
    const maxAgeHours = numberSetting(
      this.configService,
      'COMMAND_MAX_AGE_HOURS',
      24,
    );
    const since = subHours(now, maxAgeHours);
    const pending = await this.eventRepo
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.pullRequest', 'pr')
      .where('event.type = :type', { type: PrEventType.COMMENT })
      .andWhere(`event.payload->>'command' IS NOT NULL`)
      .andWhere(`event.payload->>'handledAt' IS NULL`)
      // A stale assign could act on an old comment; a stale skip only writes Relay state.
      .andWhere(
        `(event.payload->>'command' = 'skip' OR event."occurredAt" >= :since)`,
        { since },
      )
      .orderBy('event."occurredAt"', 'ASC')
      .getMany();
    if (pending.length === 0) {
      return summary;
    }

    const stats = await this.candidateStats.build(now);
    for (const event of pending) {
      if (!(await this.claim(event.id, now))) {
        continue;
      }
      const { pick, ...result } = await this.handle(event, stats);
      await this.mergePayload(event.id, result);
      // The switch is read again for every reply, so turning it off stops replies at once.
      if (
        event.occurredAt >= since &&
        (await this.appSettings.actuallyAssign())
      ) {
        await this.reply(event, result, pick);
      }
      summary[SUMMARY_KEY[result.outcome]] += 1;
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
    const isAuthorLogin =
      (event.actorLogin ?? '').toLowerCase() === pr.authorLogin.toLowerCase();
    if (!commenter && isAuthorLogin) {
      return { outcome: 'refused', reason: UNKNOWN_ACCOUNT_REASON };
    }
    if (!commenter || !author || commenter.personId !== author.personId) {
      return { outcome: 'not-author' };
    }
    // A person turned off in Relay is out of tracking and every nudge, so Relay stays quiet.
    const person = stats.candidates.find(
      (candidate) => candidate.personId === commenter.personId,
    );
    if (person && !person.active) {
      return { outcome: 'ignored' };
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
      return { outcome: 'assigned', pick: assignment };
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
    pick: PickedReviewer | undefined,
  ): Promise<void> {
    const body = replyText(result, pick);
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

// Public wording for the engine's reason phrases; a PR comment is seen by the whole team.
const PUBLIC_PHRASE: Record<string, string> = {
  'has not reviewed lately': 'has had a lighter review load lately',
};

function capitalize(phrase: string): string {
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

function assignedReply(pick: PickedReviewer): string {
  const reasons = (pick.reason ?? '')
    .split(' and ')
    .map((phrase) => phrase.trim())
    .filter(Boolean)
    .map((phrase) => `- ${capitalize(PUBLIC_PHRASE[phrase] ?? phrase)}`);
  return [
    `Requested a review from @${pick.login}, a good fit for this change.`,
    '',
    `**Why ${pick.login}**`,
    ...(pick.area ? [`This change touches ${pick.area}.`] : []),
    ...reasons,
    '',
    'Relay weighs recent work on the code, current review load, and recent reviews the same way for everyone.',
  ].join('\n');
}

function replyText(
  result: CommandResult,
  pick: PickedReviewer | undefined,
): string | null {
  switch (result.outcome) {
    case 'assigned':
      // Only a review GitHub actually received gets announced.
      return pick && pick.shadow === false ? assignedReply(pick) : null;
    case 'skipped':
      return 'Got it. Relay will stay off this pull request.';
    case 'refused':
      return `Relay didn't pick a reviewer: ${result.reason}`;
    case 'not-author':
    case 'ignored':
      return null;
  }
}
