import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PullRequest } from '@/domains/pull-requests/entities/pull-request.entity';
import { DashboardSummary } from './models/dashboard.model';

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(PullRequest) private readonly prRepo: Repository<PullRequest>,
  ) {}

  async dashboard(_repo?: string, _from?: Date, _to?: Date): Promise<DashboardSummary> {
    throw new Error('not implemented: aggregate median + p90 per wait round, cycle, SLA misses, quality (spec task 11)');
  }

  static percentile(_values: number[], _p: number): number | null {
    throw new Error('not implemented: percentile helper for median (p50) and p90');
  }
}
