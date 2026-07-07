import 'reflect-metadata';
import 'tsconfig-paths/register';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GapFillJob } from './scheduler/gap-fill.job';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const summary = await app.get(GapFillJob).pull();
    console.log('Gap-fill summary:', summary);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error('Gap-fill failed:', e);
  process.exit(1);
});
