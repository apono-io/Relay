import { Controller, Post, Req, Headers, HttpCode, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { LoggerService } from '@/infrastructure/logging/logger.service';
import { GithubEventNormalizer } from './github-event-normalizer.service';

@Controller('webhooks/github')
export class IngestionController {
  constructor(
    private readonly configService: ConfigService,
    private readonly normalizer: GithubEventNormalizer,
    private readonly logger: LoggerService,
  ) {}

  @Post()
  @HttpCode(202)
  async handle(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
  ): Promise<{ received: boolean }> {
    if (!this.verify(req.rawBody, signature)) {
      throw new BadRequestException('Invalid signature');
    }
    this.logger.log(`Received GitHub webhook: ${event}`);
    throw new Error('not implemented: normalize and persist webhook events, recompute PR (spec task 9, deployed path only)');
  }

  private verify(rawBody: Buffer | undefined, signature: string): boolean {
    const secret = this.configService.get<string>('GITHUB_WEBHOOK_SECRET') || '';
    if (!secret || !rawBody || !signature) {
      return false;
    }
    const digest = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(digest);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
