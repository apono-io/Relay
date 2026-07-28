import 'reflect-metadata';
import 'tsconfig-paths/register';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PeopleService } from './domains/people/people.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const people = app.get(PeopleService);
    const summary = await people.seedFromCommitEmails();

    console.log('');
    console.log(`Authors scanned : ${summary.authorsScanned}`);
    console.log(`People created  : ${summary.peopleCreated}`);
    console.log(`Identities added: ${summary.identitiesLinked}`);
    console.log(`Unresolved      : ${summary.unresolved.length}`);

    if (summary.unresolved.length > 0) {
      console.log('');
      console.log(
        'Needs attention (link a GitHub account or add the person by hand):',
      );
      for (const entry of summary.unresolved) {
        const seen = entry.observedEmail ? ` (saw ${entry.observedEmail})` : '';
        console.log(`  ${entry.login.padEnd(18)} ${entry.reason}${seen}`);
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error('Roster seed failed:', e);
  process.exit(1);
});
