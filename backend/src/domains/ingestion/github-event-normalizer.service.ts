import { Injectable } from '@nestjs/common';
import { PrEvent } from '@/domains/pull-requests/entities/pr-event.entity';
import { PrEventSource } from '@/domains/pull-requests/pr-enums';

export type NormalizedEvent = Omit<PrEvent, 'id' | 'createdAt' | 'pullRequest'>;

@Injectable()
export class GithubEventNormalizer {
  normalizeWebhook(_deliveryType: string, _payload: Record<string, unknown>): NormalizedEvent[] {
    throw new Error('not implemented: map a webhook payload to pr_events with canonical externalId (spec decision 14)');
  }

  normalizeBackfillNode(_repo: string, _prNode: Record<string, unknown>): NormalizedEvent[] {
    throw new Error('not implemented: map a GraphQL PR timeline node to pr_events (spec task 6)');
  }

  buildExternalId(_source: PrEventSource, _partial: Partial<NormalizedEvent>): string {
    throw new Error('not implemented: derive content-based externalId per type, never the delivery id (spec decision 14)');
  }
}
