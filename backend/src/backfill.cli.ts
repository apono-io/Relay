import 'reflect-metadata';
import 'tsconfig-paths/register';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BackfillService } from './domains/ingestion/backfill.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const summary = await app.get(BackfillService).run();
    console.log('Backfill summary:', summary);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error('Backfill failed:', e);
  process.exit(1);
});
