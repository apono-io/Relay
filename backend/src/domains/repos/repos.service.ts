import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GitHubClient } from '@/infrastructure/clients/github.client';
import { LoggerService } from '@/infrastructure/logging/logger.service';
import { Repo } from './entities/repo.entity';
import { AreaRule } from './entities/area-rule.entity';

const DEFAULT_RISK = 2;

function titleCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

@Injectable()
export class ReposService implements OnModuleInit {
  constructor(
    @InjectRepository(Repo) private readonly repoRepo: Repository<Repo>,
    @InjectRepository(AreaRule)
    private readonly ruleRepo: Repository<AreaRule>,
    private readonly configService: ConfigService,
    private readonly github: GitHubClient,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit(): void {
    void this.seedFromEnv();
  }

  private async seedFromEnv(): Promise<void> {
    try {
      const existing = await this.repoRepo.count();
      if (existing > 0) {
        return;
      }
      const names = (this.configService.get<string>('GITHUB_REPOS') || '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);
      for (const name of names) {
        await this.repoRepo.save(this.repoRepo.create({ name }));
        await this.seedAreaRules(name);
      }
      if (names.length > 0) {
        this.logger.log(`Seeded ${names.length} repo(s) from GITHUB_REPOS`);
      }
    } catch (error) {
      this.logger.error(
        `Repo seed failed: ${(error as Error).message}`,
        (error as Error).stack,
        ReposService.name,
      );
    }
  }

  async list(): Promise<Repo[]> {
    return this.repoRepo.find({ order: { name: 'ASC' } });
  }

  async names(): Promise<string[]> {
    const repos = await this.list();
    if (repos.length > 0) {
      return repos.map((repo) => repo.name);
    }
    return (this.configService.get<string>('GITHUB_REPOS') || '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
  }

  async add(name: string): Promise<Repo> {
    const trimmed = name.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(trimmed)) {
      throw new BadRequestException(
        'Use the owner/name form, for example apono-io/Relay.',
      );
    }
    const existing = await this.repoRepo.findOne({ where: { name: trimmed } });
    if (existing) {
      throw new BadRequestException(`${trimmed} is already watched.`);
    }
    if (!this.github.isConfigured()) {
      throw new BadRequestException(
        'GitHub credentials are not configured, so the repository cannot be verified.',
      );
    }
    try {
      await this.github.verifyRepoAccess(trimmed);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const repo = await this.repoRepo.save(
      this.repoRepo.create({ name: trimmed }),
    );
    await this.seedAreaRules(trimmed);
    return repo;
  }

  async seedAreaRules(repo: string): Promise<number> {
    const existing = await this.ruleRepo.count({ where: { repo } });
    if (existing > 0 || !this.github.isConfigured()) {
      return 0;
    }
    try {
      const dirs = await this.github.fetchTopLevelDirs(repo);
      for (const dir of dirs) {
        await this.ruleRepo.save(
          this.ruleRepo.create({
            repo,
            pattern: `${dir}/**`,
            area: titleCase(dir),
            risk: DEFAULT_RISK,
          }),
        );
      }
      return dirs.length;
    } catch (error) {
      this.logger.error(
        `Area-rule seed for ${repo} failed: ${(error as Error).message}`,
        (error as Error).stack,
        ReposService.name,
      );
      return 0;
    }
  }

  async areaRules(repo: string): Promise<AreaRule[]> {
    return this.ruleRepo.find({ where: { repo }, order: { pattern: 'ASC' } });
  }

  async addAreaRule(input: {
    repo: string;
    pattern: string;
    area: string;
    risk: number;
  }): Promise<AreaRule> {
    this.assertRisk(input.risk);
    const duplicate = await this.ruleRepo.findOne({
      where: { repo: input.repo, pattern: input.pattern },
    });
    if (duplicate) {
      throw new BadRequestException(
        `A rule for ${input.pattern} already exists in ${input.repo}.`,
      );
    }
    return this.ruleRepo.save(this.ruleRepo.create(input));
  }

  async updateAreaRule(
    id: string,
    input: { pattern?: string; area?: string; risk?: number },
  ): Promise<AreaRule> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException('Area rule not found');
    }
    if (input.risk !== undefined) {
      this.assertRisk(input.risk);
      rule.risk = input.risk;
    }
    if (input.pattern !== undefined) {
      rule.pattern = input.pattern;
    }
    if (input.area !== undefined) {
      rule.area = input.area;
    }
    return this.ruleRepo.save(rule);
  }

  async deleteAreaRule(id: string): Promise<boolean> {
    const result = await this.ruleRepo.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  private assertRisk(risk: number): void {
    if (!Number.isInteger(risk) || risk < 1 || risk > 5) {
      throw new BadRequestException('Risk must be a whole number from 1 to 5.');
    }
  }
}
