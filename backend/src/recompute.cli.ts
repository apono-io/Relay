import 'reflect-metadata';
import 'tsconfig-paths/register';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PullRequestsService } from './domains/pull-requests/pull-requests.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const count = await app.get(PullRequestsService).recomputeAll();
    console.log(`Recomputed ${count} pull requests from stored events.`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error('Recompute failed:', e);
  process.exit(1);
});
