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
import { DEFAULT_RISK } from './assignment-engine';
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
  | 'teamLeadReason'
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

  // RELAY_URL, else the frontend origin a deployment already sets for CORS and login.
  private relayUrl(): string {
    return (
      this.configService.get<string>('RELAY_URL') ||
      this.configService.get<string>('FRONTEND_ORIGIN') ||
      DEFAULT_RELAY_URL
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

// The app's five sensitivity levels (frontend SensitivityDots).
const SENSITIVITY_WORD: Record<number, string> = {
  1: 'Low',
  2: 'Normal',
  3: 'Elevated',
  4: 'High',
  5: 'Critical',
};

// Files outside every mapped area are weighed at the engine's default sensitivity,
// so the reply shows that level rather than nothing.
function areaLine(pick: PickedReviewer): string {
  const level = Math.max(
    1,
    Math.min(5, Math.round(pick.sensitivity || DEFAULT_RISK)),
  );
  const dots = '●'.repeat(level) + '○'.repeat(5 - level);
  const where = pick.area ? `Touches **${pick.area}**` : 'No mapped area';
  return `${where} · Sensitivity ${dots} ${SENSITIVITY_WORD[level]}`;
}

// "Platform" reads "the Platform team"; a name that already ends in "team" stays as named.
const teamLabel = (name: string): string =>
  /\bteam$/i.test(name.trim()) ? `**${name}**` : `the **${name}** team`;

// Says why the lead was asked, truthfully: loaded teammates, or nobody else pickable.
// In test mode nobody was asked, so it says "would ask".
function teamLine(pick: PickedReviewer, live: boolean): string | null {
  if (!pick.teamName) {
    return null;
  }
  if (!pick.teamLeadFallback) {
    return `From ${teamLabel(pick.teamName)}.`;
  }
  const asked = live ? 'asked' : 'would ask';
  return pick.teamLeadReason === 'unavailable'
    ? `Nobody else on **${pick.teamName}** can take this one right now, so Relay ${asked} the team lead.`
    : `Everyone else on **${pick.teamName}** already has ${pick.teamLeadThreshold} or more open reviews, so Relay ${asked} the team lead.`;
}

const relayLink = (relayUrl: string): string =>
  `[Open in Relay](${relayUrl}/dashboard)`;

// A | inside a cell would end it early and shift the row.
const tableCell = (text: string): string => text.replace(/\|/g, '\\|');

// Laid out like the app's Why popover: area, then one table row per check. In test
// mode (shadow) the reviewer is named without an @, so they get no notification, and
// a note says no review was requested. Commands sit in code spans, so they mention nobody.
function assignedReply(pick: PickedReviewer, relayUrl: string): string {
  const live = pick.shadow === false;
  const context = [teamLine(pick, live), areaLine(pick)].filter(
    (line): line is string => Boolean(line),
  );
  const rows = whyLines(pick).map((line) => {
    const mark = line.counted ? '✅' : '⚪';
    const check = line.category ? `${mark} ${line.category}` : mark;
    return `| ${check} | ${tableCell(capitalize(line.text))} |`;
  });
  return [
    live
      ? `### 👀 Relay requested a review from @${pick.login}`
      : `### 👀 Relay would request a review from ${pick.login}`,
    '',
    ...(context.length ? [...context, ''] : []),
    `| Check | Why ${pick.login}? |`,
    '|:--|:--|',
    ...rows,
    '',
    ...(live
      ? []
      : [
          '> [!NOTE]',
          `> **Test mode:** no review was requested, and ${pick.login} was not notified.`,
          '',
        ]),
    FAIRNESS_NOTE,
    `<sub>${relayLink(relayUrl)} · Commands: \`@relay team\` · \`@relay skip\` · \`@relay help\`</sub>`,
  ].join('\n');
}

function helpReply(unknownCommand: boolean, relayUrl: string): string {
  return [
    '### 📖 Relay commands',
    '',
    `${unknownCommand ? "Relay doesn't know that command yet. " : ''}Comment one of these on a pull request you opened.`,
    '',
    '| Command | What it does |',
    '|:--|:--|',
    '| `@relay` | Requests a reviewer who looks like a good fit, and explains why |',
    '| `@relay team` | The same, but only from your team |',
    '| `@relay skip` | Keeps Relay off this pull request |',
    '| `@relay help` | Shows this list |',
    '',
    `<sub>Relay acts only on commands from the pull request author · ${relayLink(relayUrl)}</sub>`,
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
      return "### 👋 Relay will stay off this pull request\n\nGot it. Relay won't pick a reviewer here. Comment `@relay` any time you want one.";
    case 'refused':
      return [
        '### ✋ No reviewer picked',
        '',
        result.reason,
        '',
        `<sub>${relayLink(relayUrl)} · \`@relay help\` lists the commands</sub>`,
      ].join('\n');
    case 'answered':
      return helpReply(unknownCommand, relayUrl);
    case 'not-author':
    case 'ignored':
      return null;
  }
}
