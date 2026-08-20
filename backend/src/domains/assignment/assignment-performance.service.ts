import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Suggestion } from './entities/suggestion.entity';
import { AssignmentPerformance } from './models/assignment-performance.model';
import {
  buildPerformance,
  PerformanceRow,
} from './assignment-performance.logic';

const PERFORMANCE_WEEKS = 12;

@Injectable()
export class AssignmentPerformanceService {
  constructor(
    @InjectRepository(Suggestion)
    private readonly suggestionRepo: Repository<Suggestion>,
  ) {}

  async performance(): Promise<AssignmentPerformance> {
    const suggestions = await this.suggestionRepo.find({
      order: { generatedAt: 'ASC' },
    });
    const rows: PerformanceRow[] = suggestions.map((suggestion) => ({
      generatedAt: suggestion.generatedAt,
      resolvedAt: suggestion.resolvedAt ?? null,
      matched: suggestion.matched ?? null,
      assignedAt: suggestion.assignedAt ?? null,
      assignedTrigger: suggestion.assignedTrigger ?? null,
      shadow: suggestion.shadow ?? null,
      area: suggestion.area ?? null,
      pickedName: suggestion.picks?.[0]?.displayName ?? null,
    }));
    return buildPerformance(rows, PERFORMANCE_WEEKS);
  }
}
