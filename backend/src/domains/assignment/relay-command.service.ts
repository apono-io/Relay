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
import { RelayAssignment } from './models/relay-assignment.model';

export type CommandOutcome =
  'assigned' | 'skipped' | 'refused' | 'not-author' | 'ignored' | 'answered';

export type CommandSummary = {
  assigned: number;
  skipped: number;
  refused: number;
  notAuthor: number;
  ignored: number;
  answered: number;
};

const SUMMARY_KEY: Record<CommandOutcome, keyof CommandSummary> = {
  assigned: 'assigned',
  skipped: 'skipped',
  refused: 'refused',
  'not-author': 'notAuthor',
  ignored: 'ignored',
  answered: 'answered',
};

const UNKNOWN_ACCOUNT_REASON =
  "Relay doesn't know this GitHub account yet. Link it in Relay under Settings, or ask an admin to add it under System settings → People.";

type CommandResult = { outcome: CommandOutcome; reason?: string };
type PickedReviewer = Pick<
  RelayAssignment,
  | 'login'
  | 'area'
  | 'reason'
  | 'shadow'
  | 'signals'
  | 'sensitivity'
  | 'teamName'
  | 'teamLeadFallback'
  | 'teamLeadThreshold'
>;
type HandledCommand = CommandResult & {
  pick?: PickedReviewer;
  unknownCommand?: boolean;
};

@Injectable()
export class RelayCommandService {
  constructor(
    @InjectRepository(PrEvent)
    private readonly eventRepo: Repository<PrEvent>,
    private readonly candidateStats: CandidateStatsService,
    private readonly actions: AssignmentActionsService,
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
      answered: 0,
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
      const { pick, unknownCommand, ...result } = await this.handle(
        event,
        stats,
      );
      await this.mergePayload(event.id, result);
      // Replies go out only as the App, also in test mode, where nobody is requested or
      // mentioned; Relay re-checks before every reply.
      if (event.occurredAt >= since && this.github.canWrite()) {
        await this.reply(event, result, pick, unknownCommand);
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
    const command = event.payload?.command as RelayCommand;
    // Help changes nothing, so anyone on the pull request may ask for it.
    if (command === 'help') {
      return { outcome: 'answered' };
    }
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

    if (command === 'unknown') {
      return { outcome: 'answered', unknownCommand: true };
    }
    if (command === 'skip') {
      return { outcome: 'skipped' };
    }
    try {
      const assignment = await this.actions.assign(
        pr.repo,
        pr.number,
        author.personId,
        'comment',
        command === 'team' ? 'team' : 'org',
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
    unknownCommand = false,
  ): Promise<void> {
    const body = replyText(result, pick, unknownCommand, this.relayUrl());
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

  private relayUrl(): string {
    return (
      this.configService.get<string>('RELAY_URL') || DEFAULT_RELAY_URL
    ).replace(/\/+$/, '');
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

type WhyLine = { category: string | null; text: string; counted: boolean };

// The same three checks, wording and counted/not-counted marks as the app's "Why?"
// popover (frontend RelayAssignmentPair whyLines), so the PR and the app agree.
function whyLines(pick: PickedReviewer): WhyLine[] {
  const phrases = (pick.reason ?? '')
    .split(' and ')
    .map((phrase) => phrase.trim())
    .filter(Boolean);
  const signals = pick.signals;
  if (!signals) {
    return phrases.map((phrase) => ({
      category: null,
      text: capitalize(PUBLIC_PHRASE[phrase] ?? phrase),
      counted: true,
    }));
  }
  const areaLabel = pick.area ?? 'this part of the code';
  const knowledge = phrases.find(
    (phrase) => phrase.startsWith('knows') || phrase.startsWith('worked'),
  );
  const open = signals.openReviewRequests;
  const recent = signals.reviewsLast14Days;
  return [
    {
      category: 'Familiarity',
      text: knowledge ?? `no recent work on ${areaLabel}`,
      counted: Boolean(knowledge),
    },
    {
      category: 'Availability',
      text:
        open === 0
          ? 'no open review requests right now'
          : `${open} open review request${open === 1 ? '' : 's'} right now`,
      counted: open === 0,
    },
    {
      category: 'Fairness',
      text:
        recent === 0
          ? 'no reviews in the last 14 days'
          : `${recent} review${recent === 1 ? '' : 's'} in the last 14 days`,
      counted: recent === 0,
    },
  ];
}

const DEFAULT_RELAY_URL = 'http://localhost:5174';

const FAIRNESS_NOTE =
  '<sub>Relay weighs recent work on this code, current review load, and reviews done in the last 14 days. Everyone gets the same three checks.</sub>';

// In test mode (shadow) the reviewer is named in bold, not @-mentioned, so they get
// no notification, and a note says no review was requested.
// The app's five sensitivity levels (frontend SensitivityDots).
const SENSITIVITY_WORD: Record<number, string> = {
  1: 'Low',
  2: 'Normal',
  3: 'Elevated',
  4: 'High',
  5: 'Critical',
};

function areaLine(pick: PickedReviewer): string | null {
  if (!pick.area) {
    return null;
  }
  if (!pick.sensitivity) {
    return `This pull request touches **${pick.area}**.`;
  }
  const level = Math.max(1, Math.min(5, Math.round(pick.sensitivity)));
  const dots = '●'.repeat(level) + '○'.repeat(5 - level);
  return `This pull request touches **${pick.area}** · Sensitivity ${dots} ${SENSITIVITY_WORD[level]}`;
}

function teamLine(pick: PickedReviewer): string | null {
  if (!pick.teamName) {
    return null;
  }
  return pick.teamLeadFallback
    ? `Everyone else on **${pick.teamName}** already has ${pick.teamLeadThreshold} or more open reviews, so Relay asked the team lead.`
    : `From the **${pick.teamName}** team.`;
}

const relayLink = (relayUrl: string): string =>
  `[Open in Relay](${relayUrl}/dashboard)`;

function assignedReply(pick: PickedReviewer, relayUrl: string): string {
  const live = pick.shadow === false;
  const area = areaLine(pick);
  const team = teamLine(pick);
  // GitHub comments break lines on every newline, so each check sits on its own line.
  const lines = whyLines(pick).map((line) => {
    const mark = line.counted ? '✅' : '⚪';
    const label = line.category ? `**${line.category}:** ` : '';
    return `${mark} ${label}${line.text}`;
  });
  return [
    live
      ? `Requested a review from @${pick.login}.`
      : `Relay would request a review from **${pick.login}**.`,
    ...(team ? [team] : []),
    '',
    `#### Why ${pick.login}?`,
    ...(area ? [area, ''] : []),
    ...lines,
    '',
    FAIRNESS_NOTE,
    ...(live
      ? []
      : [
          '',
          '> [!NOTE]',
          `> Test mode: no review was requested, and ${pick.login} was not notified.`,
        ]),
    '',
    relayLink(relayUrl),
  ].join('\n');
}

function helpReply(unknownCommand: boolean, relayUrl: string): string {
  return [
    '#### Relay commands',
    ...(unknownCommand ? ["Relay doesn't know that command yet.", ''] : []),
    'Comment one of these on a pull request you opened:',
    '',
    '- `@relay`: Relay requests a reviewer who looks like a good fit, and explains why.',
    '- `@relay team`: the same, but only from your team.',
    '- `@relay skip`: Relay stays off this pull request.',
    '- `@relay help`: this list.',
    '',
    '<sub>Relay acts only on commands from the pull request author.</sub>',
    '',
    relayLink(relayUrl),
  ].join('\n');
}

function replyText(
  result: CommandResult,
  pick: PickedReviewer | undefined,
  unknownCommand: boolean,
  relayUrl: string,
): string | null {
  switch (result.outcome) {
    case 'assigned':
      return pick ? assignedReply(pick, relayUrl) : null;
    case 'skipped':
      return "#### Relay will stay off this pull request\nGot it. Relay won't pick a reviewer here.";
    case 'refused':
      return `#### No reviewer picked\n${result.reason}`;
    case 'answered':
      return helpReply(unknownCommand, relayUrl);
    case 'not-author':
    case 'ignored':
      return null;
  }
}
