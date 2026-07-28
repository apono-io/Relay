import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ConfigService } from '@nestjs/config';
import { Person } from './entities/person.entity';
import {
  GithubIdentity,
  IdentitySource,
  canTakeFromAnotherPerson,
  outranks,
  sourceRank,
} from './entities/github-identity.entity';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { LoggerService } from '@/infrastructure/logging/logger.service';
import {
  CommitEmailResolver,
  UnresolvedReason,
} from './commit-email-resolver.service';

export type SeedSummary = {
  authorsScanned: number;
  peopleCreated: number;
  identitiesLinked: number;
  unresolved: {
    login: string;
    reason: UnresolvedReason;
    observedEmail: string | null;
  }[];
};

export type PersonInput = {
  email: string;
  displayName?: string;
  githubLogin?: string;
  team?: string;
  timezone?: string;
  role?: string;
  active?: boolean;
};

@Injectable()
export class PeopleService {
  private readonly defaultRole: string;

  constructor(
    @InjectRepository(Person) private readonly personRepo: Repository<Person>,
    @InjectRepository(GithubIdentity)
    private readonly identityRepo: Repository<GithubIdentity>,
    @InjectRepository(PullRequest)
    private readonly pullRequestRepo: Repository<PullRequest>,
    private readonly commitEmailResolver: CommitEmailResolver,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.defaultRole =
      this.configService.get<string>('DEFAULT_PERSON_ROLE') || 'developer';
  }

  static pickDisplayLogin(identities: GithubIdentity[]): string | null {
    const ordered = [...identities].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const best = ordered.reduce<GithubIdentity | null>(
      (winner, identity) =>
        !winner || sourceRank(identity.source) > sourceRank(winner.source)
          ? identity
          : winner,
      null,
    );
    return best ? best.login : null;
  }

  findAll(): Promise<Person[]> {
    return this.personRepo.find({
      relations: { identities: true },
      order: { email: 'ASC' },
    });
  }

  findById(id: string): Promise<Person | null> {
    return this.personRepo.findOne({
      where: { id },
      relations: { identities: true },
    });
  }

  findByEmail(email: string): Promise<Person | null> {
    return this.personRepo
      .createQueryBuilder('person')
      .leftJoinAndSelect('person.identities', 'identity')
      .where('LOWER(person.email) = LOWER(:email)', { email })
      .getOne();
  }

  async findByGithubLogin(githubLogin: string): Promise<Person | null> {
    const identity = await this.findIdentity(githubLogin);
    return identity ? this.findById(identity.personId) : null;
  }

  async ensurePerson(email: string, displayName?: string): Promise<Person> {
    const existing = await this.findByEmail(email);
    if (existing) {
      return existing;
    }
    try {
      const created = await this.personRepo.save(
        this.personRepo.create({
          email,
          displayName,
          role: this.defaultRole,
          active: false,
        }),
      );
      this.logger.log(
        `Created person ${email} with role ${created.role}`,
        PeopleService.name,
      );
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) {
        const winner = await this.findByEmail(email);
        if (winner) {
          return winner;
        }
      }
      throw error;
    }
  }

  async create(input: PersonInput): Promise<Person> {
    await this.assertEmailFree(input.email);
    const person = await this.personRepo.save(
      this.personRepo.create({
        email: input.email,
        displayName: input.displayName,
        team: input.team,
        timezone: input.timezone,
        role: input.role || this.defaultRole,
        active: true,
      }),
    );
    if (input.githubLogin) {
      await this.recordIdentity(
        person.id,
        input.githubLogin,
        IdentitySource.MANUAL,
      );
    }
    return (await this.findById(person.id))!;
  }

  async update(
    id: string,
    input: Partial<PersonInput>,
  ): Promise<Person | null> {
    const person = await this.personRepo.findOne({ where: { id } });
    if (!person) {
      return null;
    }
    const patch: QueryDeepPartialEntity<Person> = {};
    if (
      input.email !== undefined &&
      input.email.toLowerCase() !== person.email.toLowerCase()
    ) {
      await this.assertEmailFree(input.email);
    }
    if (input.email !== undefined) patch.email = input.email;
    if (input.displayName !== undefined) patch.displayName = input.displayName;
    if (input.team !== undefined) patch.team = input.team;
    if (input.timezone !== undefined) patch.timezone = input.timezone;
    if (input.role !== undefined) patch.role = input.role;
    if (input.active !== undefined) patch.active = input.active;

    if (Object.keys(patch).length > 0) {
      await this.personRepo.update(id, patch);
    }
    if (input.githubLogin) {
      await this.recordIdentity(id, input.githubLogin, IdentitySource.MANUAL);
    }
    return this.findById(id);
  }

  async setActive(id: string, active: boolean): Promise<Person | null> {
    const person = await this.personRepo.findOne({ where: { id } });
    if (!person) {
      return null;
    }
    await this.personRepo.update(id, { active });
    return this.findById(id);
  }

  async recordIdentity(
    personId: string,
    login: string,
    source: IdentitySource,
  ): Promise<GithubIdentity | null> {
    const existing = await this.findIdentity(login);

    if (existing && existing.personId !== personId) {
      const stored = existing.source;
      if (!canTakeFromAnotherPerson(source, stored)) {
        this.logger.warn(
          `Kept ${login} on person ${existing.personId}: ${stored} there beats ${source} here`,
          PeopleService.name,
        );
        return null;
      }
      await this.identityRepo.update(existing.id, { personId, login, source });
      await this.refreshDisplayLogin(existing.personId);
      await this.refreshDisplayLogin(personId);
      return this.identityRepo.findOne({ where: { id: existing.id } });
    }

    if (existing) {
      if (outranks(source, existing.source)) {
        await this.identityRepo.update(existing.id, { login, source });
      }
      await this.refreshDisplayLogin(personId);
      return this.identityRepo.findOne({ where: { id: existing.id } });
    }

    const created = await this.identityRepo.save(
      this.identityRepo.create({ personId, login, source }),
    );
    await this.refreshDisplayLogin(personId);
    return created;
  }

  async seedFromCommitEmails(): Promise<SeedSummary> {
    const authors = await this.authorsWithRecentPullRequests();
    const summary: SeedSummary = {
      authorsScanned: authors.length,
      peopleCreated: 0,
      identitiesLinked: 0,
      unresolved: [],
    };

    this.logger.log(
      `Seeding roster from commit emails: ${authors.length} author login(s), domain ${this.commitEmailResolver.domain()}`,
      PeopleService.name,
    );

    for (const author of authors) {
      if (await this.findIdentity(author.login)) {
        continue;
      }

      const probe = await this.commitEmailResolver.probe(
        author.login,
        author.pullRequests,
      );
      if (!probe.email) {
        summary.unresolved.push({
          login: author.login,
          reason: probe.reason ?? 'no_domain_email',
          observedEmail: probe.observedEmail,
        });
        continue;
      }

      const before = await this.findByEmail(probe.email);
      const person = before ?? (await this.ensurePerson(probe.email));
      if (!before) {
        summary.peopleCreated += 1;
      }

      for (const login of probe.logins) {
        const identity = await this.recordIdentity(
          person.id,
          login,
          IdentitySource.COMMIT_EMAIL,
        );
        if (identity) {
          summary.identitiesLinked += 1;
        }
      }
    }

    this.logger.log(
      `Seed done: ${summary.peopleCreated} created, ${summary.identitiesLinked} identities, ${summary.unresolved.length} unresolved`,
      PeopleService.name,
    );
    return summary;
  }

  async unmappedLogins(): Promise<string[]> {
    const rows = await this.pullRequestRepo
      .createQueryBuilder('pr')
      .select('DISTINCT pr."authorLogin"', 'login')
      .where('pr."isBot" = false')
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM github_identities identity WHERE LOWER(identity.login) = LOWER(pr."authorLogin"))',
      )
      .orderBy('login', 'ASC')
      .getRawMany<{ login: string }>();
    return rows.map((row) => row.login);
  }

  async unresolvedIdentities(): Promise<Person[]> {
    const people = await this.findAll();
    return people.filter(
      (person) =>
        person.identities.length > 0 &&
        person.identities.every(
          (identity) => identity.source === IdentitySource.COMMIT_EMAIL,
        ),
    );
  }

  private async assertEmailFree(email: string): Promise<void> {
    if (await this.findByEmail(email)) {
      throw new ConflictException(
        `A person with the email ${email} already exists`,
      );
    }
  }

  private findIdentity(login: string): Promise<GithubIdentity | null> {
    return this.identityRepo
      .createQueryBuilder('identity')
      .where('LOWER(identity.login) = LOWER(:login)', { login })
      .getOne();
  }

  private async refreshDisplayLogin(personId: string): Promise<void> {
    const identities = await this.identityRepo.find({ where: { personId } });
    await this.personRepo.update(personId, {
      githubLogin: PeopleService.pickDisplayLogin(identities),
    });
  }

  private async authorsWithRecentPullRequests(): Promise<
    { login: string; pullRequests: { repo: string; number: number }[] }[]
  > {
    const rows = await this.pullRequestRepo
      .createQueryBuilder('pr')
      .select([
        'pr."authorLogin" AS login',
        'pr.repo AS repo',
        'pr.number AS number',
      ])
      .where('pr."isBot" = false')
      .orderBy('pr."authorLogin"', 'ASC')
      .addOrderBy('pr."openedAt"', 'DESC', 'NULLS LAST')
      .getRawMany<{ login: string; repo: string; number: number }>();

    const byLogin = new Map<
      string,
      { login: string; pullRequests: { repo: string; number: number }[] }
    >();
    for (const row of rows) {
      const key = row.login.toLowerCase();
      const entry = byLogin.get(key) ?? { login: row.login, pullRequests: [] };
      entry.pullRequests.push({ repo: row.repo, number: row.number });
      byLogin.set(key, entry);
    }
    return Array.from(byLogin.values());
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as { code?: string }).code === '23505'
  );
}
