import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AreaRule } from './entities/area-rule.entity';
import { AssignmentEngine } from '@/domains/assignment/assignment-engine';

const RULES_CACHE_TTL_MS = 60_000;

export type AreaClassification = {
  area: string | null;
  sensitivity: number;
};

export type ClassifiablePr = {
  id: string;
  repo: string;
  filePaths?: string[] | null;
};

@Injectable()
export class PrAreaService {
  private rulesByRepo = new Map<string, AreaRule[]>();
  private rulesLoadedAt = 0;

  constructor(
    @InjectRepository(AreaRule)
    private readonly areaRuleRepo: Repository<AreaRule>,
  ) {}

  async classify(pr: ClassifiablePr): Promise<AreaClassification> {
    const rules = await this.rulesFor(pr.repo);
    return this.classifyWith(pr, rules);
  }

  async classifyMany(
    prs: ClassifiablePr[],
  ): Promise<Map<string, AreaClassification>> {
    const result = new Map<string, AreaClassification>();
    if (prs.length === 0) {
      return result;
    }
    await this.loadRules();
    for (const pr of prs) {
      const rules = this.rulesByRepo.get(pr.repo) ?? [];
      result.set(pr.id, this.classifyWith(pr, rules));
    }
    return result;
  }

  invalidate(): void {
    this.rulesLoadedAt = 0;
  }

  private classifyWith(
    pr: ClassifiablePr,
    rules: AreaRule[],
  ): AreaClassification {
    const paths = pr.filePaths ?? [];
    if (paths.length === 0 || rules.length === 0) {
      return { area: null, sensitivity: 0 };
    }
    const match = AssignmentEngine.classify(paths, rules);
    return { area: match.area, sensitivity: match.area ? match.risk : 0 };
  }

  private async rulesFor(repo: string): Promise<AreaRule[]> {
    await this.loadRules();
    return this.rulesByRepo.get(repo) ?? [];
  }

  private async loadRules(): Promise<void> {
    if (Date.now() - this.rulesLoadedAt < RULES_CACHE_TTL_MS) {
      return;
    }
    const rules = await this.areaRuleRepo.find();
    const grouped = new Map<string, AreaRule[]>();
    for (const rule of rules) {
      const existing = grouped.get(rule.repo);
      if (existing) {
        existing.push(rule);
      } else {
        grouped.set(rule.repo, [rule]);
      }
    }
    this.rulesByRepo = grouped;
    this.rulesLoadedAt = Date.now();
  }
}
